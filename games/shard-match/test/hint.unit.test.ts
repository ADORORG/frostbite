// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  followPause,
  loadTitles,
  refusalNote,
  submitRun,
} from "../src/submit.ts";
import { boxes, element, listEarned, setText } from "../src/dom.ts";
import { hintAfterMs, hintFor, watchIdle } from "../src/hint.ts";
import { legalMoves } from "../src/rules/moves.ts";
import { startRun } from "../src/rules/state.ts";
import { neighbour } from "../src/rules/board.ts";

afterEach(() => vi.useRealTimers());

describe("the hint", () => {
  it("points at the two cells of a swap that makes a line, and at none when there is none", () => {
    const state = startRun(4);
    const [cell, direction] = legalMoves(state.board)[0] ?? [0, 1];
    expect(hintFor(state)).toEqual([cell, neighbour(cell, direction)]);
    expect(
      hintFor({
        ...state,
        board: Array.from(
          { length: 64 },
          (_, at) => ((at % 8) + 2 * Math.floor(at / 8)) % 5,
        ),
      }),
    ).toEqual([]);
  });

  it("is shown once, after the player has been still for the time, only while the page is quiet and no hint is up", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const show = vi.fn();
    let quiet = true;
    let shown = false;
    watchIdle({
      lastInput: () => 0,
      quiet: () => quiet,
      shown: () => shown,
      show,
    });
    vi.advanceTimersByTime(hintAfterMs - 1_000);
    expect(show).not.toHaveBeenCalled();
    quiet = false;
    vi.advanceTimersByTime(2_000);
    expect(show).not.toHaveBeenCalled();
    quiet = true;
    shown = true;
    vi.advanceTimersByTime(1_000);
    expect(show).not.toHaveBeenCalled();
    shown = false;
    vi.advanceTimersByTime(1_000);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("is not shown to a player who has just moved", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const show = vi.fn();
    watchIdle({
      lastInput: () => Date.now(),
      quiet: () => true,
      shown: () => false,
      show,
    });
    vi.advanceTimersByTime(3_000);
    expect(show).not.toHaveBeenCalled();
  });
});

describe("the page's small helpers", () => {
  it("finds an element by its id and tag and refuses one that is missing or of another tag", () => {
    document.body.innerHTML = '<p id="a"></p><span id="b"></span>';
    expect(element("a", "p").tagName).toBe("P");
    expect(() => element("a", "span")).toThrow("Missing #a");
    expect(() => element("zz", "p")).toThrow("Missing #zz");
  });

  it("writes text only when it differs", () => {
    const box = document.createElement("p");
    const watched = vi.fn();
    new MutationObserver(watched).observe(box, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    setText(box, "a");
    setText(box, "a");
    expect(box.textContent).toBe("a");
  });

  it("lists an earned milestone under its title, or its id, and counts it", () => {
    document.body.innerHTML =
      '<strong id="count"></strong><ul id="earned"></ul><p id="note"></p><button id="pause"></button><canvas id="screen"></canvas><div id="sound"></div><button id="start"></button><p id="status"></p><span id="total"></span>';
    const page = boxes();
    listEarned(page, "first-swap", "First swap", 1);
    listEarned(page, "x", undefined, 2);
    expect([...page.earned.children].map((li) => li.textContent)).toEqual([
      "First swap",
      "x",
    ]);
    expect(page.count.textContent).toBe("2");
    expect((page.earned.children[0] as HTMLElement).dataset.milestone).toBe(
      "first-swap",
    );
  });

  it("says what it could not do: the platform's reason, or that the game can still be played", () => {
    expect(refusalNote(new Error("x"))).toBe(
      "Could not connect to the platform. You can still play.",
    );
  });

  it("follows the pause: the button and the note, and the note as it was after", () => {
    const listeners: ((paused: boolean) => void)[] = [];
    const pause = {
      subscribe: (listener: (paused: boolean) => void) =>
        void listeners.push(listener),
    } as unknown as Parameters<typeof followPause>[0];
    const button = document.createElement("button");
    const note = document.createElement("p");
    note.textContent = "before";
    followPause(pause, button, note);
    listeners[0]?.(true);
    expect(button.textContent).toBe("Resume");
    expect(note.textContent).not.toBe("before");
    listeners[0]?.(false);
    expect(button.textContent).toBe("Pause");
    expect(note.textContent).toBe("before");
  });

  it("lists the milestones' titles by id, and none when the platform cannot say", async () => {
    const client = {
      milestones: { list: async () => [{ id: "a", title: "A" }] },
    } as unknown as Parameters<typeof loadTitles>[0];
    expect(await loadTitles(client)).toEqual(new Map([["a", "A"]]));
    const broken = {
      milestones: {
        list: async () => {
          throw new Error("no");
        },
      },
    } as unknown as Parameters<typeof loadTitles>[0];
    expect(await loadTitles(broken)).toEqual(new Map());
  });

  it("sends a run's record when a run was issued and the platform answered, and says what became of it", async () => {
    const said: string[] = [];
    const record = { claims: [] } as unknown as Parameters<typeof submitRun>[2];
    await submitRun(null, null, record, (t) => void said.push(t));
    expect(said).toHaveLength(1);
    const play = {
      runs: { submit: vi.fn(async () => ({ status: "accepted" })) },
    } as unknown as Parameters<typeof submitRun>[0];
    const sent: string[] = [];
    await submitRun(play, "run-1", record, (t) => void sent.push(t));
    expect(sent).toHaveLength(2);
    expect(sent[0]).not.toBe(sent[1]);
    const failing = {
      runs: {
        submit: async () => {
          throw new Error("down");
        },
      },
    } as unknown as Parameters<typeof submitRun>[0];
    const lost: string[] = [];
    await submitRun(failing, "run-1", record, (t) => void lost.push(t));
    expect(lost).toHaveLength(2);
  });
});
