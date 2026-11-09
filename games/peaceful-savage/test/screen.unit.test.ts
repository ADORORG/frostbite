// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCardMaker } from "../src/page/cards.ts";
import { createHud } from "../src/page/hud.ts";
import { createMomentPanel } from "../src/page/moment.ts";
import { createOverlay } from "../src/page/overlay.ts";
import { createScreen } from "../src/page/screen.ts";
import { createSelect } from "../src/page/select.ts";
import { north } from "../src/page/steer.ts";
import { startRun } from "../src/rules/state.ts";
import { byId, loadPage } from "./support/dom.ts";

beforeEach(loadPage);
afterEach(() => {
  vi.restoreAllMocks();
});

// A 2D context that takes any drawing call and counts them.
function counting() {
  const calls = { count: 0 };
  const context = new Proxy(
    {},
    {
      get: () => () => {
        calls.count += 1;
      },
      set: () => true,
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  return calls;
}

describe("the screen and what is over it", () => {
  it("falls back to the flat map without WebGL 2, draws it with everything over it, and takes a share card's picture when one is due", () => {
    const calls = counting();
    const cards = createCardMaker();
    const made: string[] = [];
    const screen = createScreen({
      cards,
      hud: createHud(() => undefined),
      moment: createMomentPanel(() => undefined),
      onCard: (card) => made.push(card.words.title),
      overlay: createOverlay(() => "E"),
      select: createSelect(),
    });
    expect(screen.build()).toBe(false);
    expect(byId("world").hidden).toBe(true);
    expect(screen.forward()).toEqual(north);
    const state = startRun(4);
    cards.hear({ detail: "", kind: "sparky", tick: 1 }, state, 0);
    screen.draw({
      alpha: 1,
      best: 12,
      card: null,
      previous: state,
      running: false,
      state,
      time: 5_000,
    });
    expect(calls.count).toBeGreaterThan(20);
    expect(made).toEqual(["Sparky is found"]);
    expect(byId("best").textContent).toBe("12");
  });

  it("has nothing to draw on where even a 2D canvas cannot be had", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => null,
    );
    const screen = createScreen({
      cards: createCardMaker(),
      hud: createHud(() => undefined),
      moment: createMomentPanel(() => undefined),
      onCard: () => undefined,
      overlay: createOverlay(() => "E"),
      select: createSelect(),
    });
    expect(screen.build()).toBe(false);
    const state = startRun(4);
    screen.draw({
      alpha: 1,
      best: 0,
      card: null,
      previous: state,
      running: false,
      state,
      time: 0,
    });
    expect(byId("score").textContent).toBe("0");
  });
});
