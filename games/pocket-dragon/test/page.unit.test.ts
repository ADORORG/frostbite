// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { freshProgress } from "../src/progress.ts";
import { buttonsIn, element } from "../src/page/elements.ts";
import {
  actions,
  attachHands,
  playOfKey,
  type Action,
} from "../src/page/hands.ts";
import { startRun } from "../src/page/runs.ts";
import { createView } from "../src/page/view.ts";
import { surface } from "./support/canvas.ts";

const page = readFileSync(join(import.meta.dirname, "../index.html"), "utf8");
const stops: (() => void)[] = [];
beforeEach(() => {
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/u.exec(page)?.[1] ?? "";
});
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.restoreAllMocks();
});
const key = (type: "keydown" | "keyup", code: string) =>
  window.dispatchEvent(new KeyboardEvent(type, { cancelable: true, code }));
const touch = (target: Element, type: string) =>
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true }),
  );
const hands = () => {
  const handed = { hold: vi.fn(), pause: vi.fn(), start: vi.fn() };
  stops.push(attachHands(document.body, handed));
  return handed;
};

describe("the player's hands", () => {
  it("hold each action on its keys while the keys are down, the challenge hotkeys among them", () => {
    const handed = hands();
    for (const [code, action] of [
      ["ArrowLeft", "left"],
      ["KeyA", "left"],
      ["ArrowRight", "right"],
      ["KeyD", "right"],
      ["ArrowUp", "up"],
      ["KeyW", "up"],
      ["ArrowDown", "down"],
      ["KeyS", "down"],
      ["Space", "act"],
      ["KeyZ", "act"],
      ["KeyF", "fire"],
      ["KeyX", "fire"],
      ["Digit1", "hot1"],
      ["Numpad5", "hot5"],
      ["KeyQ", "quick"],
      ["KeyE", "evade"],
      ["KeyC", "charm"],
    ] as const) {
      key("keydown", code);
      expect(handed.hold).toHaveBeenLastCalledWith(action, true);
      key("keyup", code);
      expect(handed.hold).toHaveBeenLastCalledWith(action, false);
    }
  });

  it("start on Enter and pause on P on the press alone, and know what a number key chooses between runs", () => {
    const handed = hands();
    for (const code of ["Enter", "KeyP"]) {
      key("keydown", code);
      key("keyup", code);
    }
    expect(handed.start).toHaveBeenCalledTimes(1);
    expect(handed.pause).toHaveBeenCalledTimes(1);
    expect(handed.hold).not.toHaveBeenCalled();
    const asked: readonly Action[] = [
      "hot0",
      "hot1",
      "hot2",
      "hot3",
      "hot4",
      "quick",
    ];
    expect(asked.map(playOfKey)).toEqual([
      "quest",
      "hills",
      "castle",
      "woods",
      undefined,
      undefined,
    ]);
    key("keydown", "Digit0");
    expect(handed.hold).toHaveBeenLastCalledWith("hot0", true);
  });

  it("hold a touch button while a finger is on it, and let everything go when the page is left", () => {
    const handed = hands();
    const fire = document.querySelector('[data-hold="fire"]');
    if (fire === null) throw new Error("no fire button");
    touch(fire, "pointerdown");
    expect(handed.hold).toHaveBeenLastCalledWith("fire", true);
    touch(fire, "pointerup");
    expect(handed.hold).toHaveBeenLastCalledWith("fire", false);
    touch(document.body, "pointerdown");
    expect(handed.hold).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("blur"));
    expect(handed.hold).toHaveBeenCalledTimes(2 + actions.length);
  });
});

describe("a level's run as the page plays it", () => {
  it("gives each action its meaning in the level, and holds a control while any of its actions is held", () => {
    const run = startRun("hills", 4);
    run.hold("act", true);
    run.hold("up", true);
    run.hold("act", false);
    run.hold("down", true);
    run.hold("quick", true);
    expect(run.record().inputs.map(({ type }) => type)).toEqual([
      "jump",
      "down",
      "end",
    ]);
    const woods = startRun("woods", 4);
    woods.hold("act", true);
    woods.hold("hot1", true);
    expect(woods.record().inputs.map(({ type }) => type)).toEqual([
      "fire",
      "end",
    ]);
    const castle = startRun("castle", 4);
    castle.hold("hot2", true);
    expect(castle.record().inputs[0]).toEqual({
      data: { on: 1, tick: 0 },
      type: "show2",
    });
  });

  it("plays, scores, counts metaplasma and draws the same for every level, and is never a won quest", () => {
    for (const id of ["hills", "castle", "woods"] as const) {
      const run = startRun(id, 4);
      expect(run.tick()).toEqual(expect.any(Array));
      expect(run.ended()).toBe(false);
      expect(run.cleared()).toEqual([]);
      expect(run.won()).toBe(false);
      expect(run.fame()).toBeNull();
      expect(run.level()).toBe(id);
      expect(run.earned()).toEqual([]);
      expect(run.score()).toBe(0);
      expect(run.plasma()).toBeGreaterThanOrEqual(0);
      expect(run.stats()).toHaveLength(3);
      const screen = surface();
      run.draw(screen.context);
      expect(screen.drawn.length).toBeGreaterThan(0);
    }
  });
});

describe("the page's view", () => {
  it("draws the run twice its size with its counts and the metaplasma banked, and the guide on an idle screen", () => {
    const screen = surface();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      screen.context,
    );
    const view = createView();
    view.draw(startRun("woods", 4), true, 70, 12_345);
    expect(element("screen", "canvas").width).toBe(512);
    expect(screen.transforms).toEqual([[2, 0, 0, 2, 0, 0]]);
    expect(element("score", "strong").textContent).toBe("0");
    expect(element("best", "strong").textContent).toBe("70");
    expect(element("plasma", "strong").textContent).toBe("0");
    expect(element("banked", "strong").textContent).toBe("12,345");
    expect(element("stat-0-label", "span").textContent).toBe("Clues");
    expect(element("stat-1", "strong").textContent).toBe("0 of 4");
    expect(screen.texts()).toContain("THE WHISPERING WOODS");
    const playing = {
      ...startRun("hills", 4),
      plasma: () => 7,
      score: () => 40,
    };
    view.draw(playing, false, 70, 12_346);
    expect(element("score", "strong").textContent).toBe("40");
    expect(element("plasma", "strong").textContent).toBe("7");
    expect(screen.transforms).toHaveLength(2);
  });

  it("still keeps the counts when the screen cannot be drawn on", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    createView().draw(startRun("castle", 4), true, 3, 9);
    expect(element("best", "strong").textContent).toBe("3");
    expect(element("banked", "strong").textContent).toBe("9");
  });

  it("opens the quest and the levels reached, offers each level's touch buttons, and lists what was earned", () => {
    const view = createView();
    view.chapters("castle", { ...freshProgress, unlocked: 2 }, false);
    const [quest, hills, castle, woods] = buttonsIn(document, "[data-chapter]");
    expect([
      quest?.disabled,
      hills?.disabled,
      castle?.disabled,
      woods?.disabled,
    ]).toEqual([false, false, false, true]);
    expect(castle?.getAttribute("aria-pressed")).toBe("true");
    expect(quest?.querySelector("span")?.textContent).toBe("0");
    expect(castle?.querySelector("span")?.textContent).toBe("2");
    expect(woods?.querySelector("span")?.textContent).toBe("🔒");
    expect(quest?.title).toContain("All three levels");
    expect(woods?.title).toContain("Clear the level before");
    view.level("woods");
    expect(element("act", "button").textContent).toBe("Fire");
    expect(element("screen", "canvas").getAttribute("aria-label")).toContain(
      "maze",
    );
    const hidden = () =>
      buttonsIn(document, "#pad [hidden]").map((button) => button.dataset.hold);
    expect(hidden()).toEqual(["act", "quick", "evade", "charm"]);
    view.level("castle");
    expect(hidden()).toEqual([]);
    view.chapters("woods", freshProgress, true);
    expect(
      buttonsIn(document, "[data-chapter]").every((button) => button.disabled),
    ).toBe(true);
    view.earned(
      ["first-egg", "mystery"],
      new Map([["first-egg", "First egg"]]),
    );
    expect(
      [...document.querySelectorAll("#earned li")].map(
        (item) => item.textContent,
      ),
    ).toEqual(["First egg", "mystery"]);
    view.running(true);
    expect(element("start", "button").hidden).toBe(true);
    expect(
      buttonsIn(document, "#pad button").some((button) => button.disabled),
    ).toBe(false);
  });

  it("lists the Hall of Fame best first, and says how to get in while it is empty", () => {
    const view = createView();
    view.fame([]);
    expect(element("fame-note", "p").hidden).toBe(false);
    view.fame([
      { eggs: 90, hearts: 3, score: 52_300, secrets: 6, ticks: 36_060 },
      { eggs: 12, hearts: 1, score: 9_000, secrets: 0, ticks: 61_000 },
    ]);
    expect(element("fame-note", "p").hidden).toBe(true);
    expect(
      [...document.querySelectorAll("#fame li")].map((item) => [
        item.getAttribute("data-rank"),
        item.textContent,
      ]),
    ).toEqual([
      ["1", "52,300 points in 10:01, 3 hearts, 90 eggs, 6 secrets"],
      ["2", "9,000 points in 16:56, 1 heart, 12 eggs, 0 secrets"],
    ]);
  });

  it("stops at a missing or misnamed element", () => {
    expect(() => element("nowhere", "div")).toThrow("Missing #nowhere");
    expect(() => element("score", "div")).toThrow("Missing #score");
  });
});
