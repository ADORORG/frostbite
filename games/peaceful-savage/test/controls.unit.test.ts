// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachKeyboard,
  attachTouch,
  holdMs,
  runPixels,
  type Hands,
} from "../src/page/controls.ts";
import { byId, loadPage, pointer } from "./support/dom.ts";

let running = false;
let choosing = false;
let inMoment = false;
const hands = (): Hands => ({
  act: vi.fn(),
  cards: vi.fn(),
  choose: vi.fn(),
  choosing: () => choosing,
  end: vi.fn(),
  inMoment: () => inMoment,
  jump: vi.fn(),
  pause: vi.fn(),
  practise: vi.fn(),
  running: () => running,
  start: vi.fn(),
  steer: vi.fn(),
  turn: vi.fn(),
  vision: vi.fn(),
});

const key = (type: "keydown" | "keyup", code: string): void => {
  window.dispatchEvent(new KeyboardEvent(type, { bubbles: true, code }));
};
const press = (code: string): void => {
  key("keydown", code);
  key("keyup", code);
};

let detach: (() => void) | null = null;
beforeEach(() => {
  loadPage();
  running = false;
  choosing = false;
  inMoment = false;
  if (!("setPointerCapture" in HTMLElement.prototype))
    Object.assign(HTMLElement.prototype, {
      setPointerCapture: () => undefined,
    });
});
afterEach(() => {
  detach?.();
  detach = null;
  vi.useRealTimers();
});

describe("the keys", () => {
  it("turn to who leads before a run, and start it on Enter", () => {
    const held = hands();
    detach = attachKeyboard(held);
    press("ArrowLeft");
    press("KeyD");
    press("ArrowUp");
    press("KeyE");
    press("Enter");
    expect(held.turn).toHaveBeenNthCalledWith(1, -1);
    expect(held.turn).toHaveBeenNthCalledWith(2, 1);
    expect(held.turn).toHaveBeenCalledTimes(2);
    expect(held.steer).not.toHaveBeenCalled();
    expect(held.act).not.toHaveBeenCalled();
    expect(held.start).toHaveBeenCalledOnce();
  });

  it("walk with the arrows or WASD, act on E (held, it breathes in), jump on Space (in a moment it acts), and open vision, pause and practise", () => {
    running = true;
    const held = hands();
    detach = attachKeyboard(held);
    key("keydown", "ArrowUp");
    key("keydown", "KeyD");
    key("keyup", "ArrowUp");
    key("keyup", "KeyD");
    expect(held.steer).toHaveBeenNthCalledWith(1, { x: 0, y: 1 }, false);
    expect(held.steer).toHaveBeenNthCalledWith(2, { x: 1, y: 1 }, false);
    expect(held.steer).toHaveBeenNthCalledWith(3, { x: 1, y: 0 }, false);
    expect(held.steer).toHaveBeenLastCalledWith(null, false);
    // Shift held runs, and let go, walks again.
    key("keydown", "KeyW");
    key("keydown", "ShiftLeft");
    expect(held.steer).toHaveBeenLastCalledWith({ x: 0, y: 1 }, true);
    key("keyup", "ShiftLeft");
    expect(held.steer).toHaveBeenLastCalledWith({ x: 0, y: 1 }, false);
    key("keyup", "KeyW");
    // Walking about, Space jumps and acts on nothing; in a moment it is the act key, down and up.
    key("keydown", "Space");
    key("keyup", "Space");
    expect(held.jump).toHaveBeenCalledOnce();
    expect(held.act).not.toHaveBeenCalled();
    inMoment = true;
    key("keydown", "Space");
    key("keyup", "Space");
    inMoment = false;
    expect(held.act).toHaveBeenNthCalledWith(1, true);
    expect(held.act).toHaveBeenNthCalledWith(2, false);
    expect(held.jump).toHaveBeenCalledOnce();
    key("keydown", "KeyE");
    key("keyup", "KeyE");
    expect(held.act).toHaveBeenNthCalledWith(3, true);
    expect(held.act).toHaveBeenNthCalledWith(4, false);
    press("KeyQ");
    press("KeyP");
    press("Digit3");
    expect(held.vision).toHaveBeenCalledOnce();
    expect(held.pause).toHaveBeenCalledOnce();
    expect(held.practise).toHaveBeenCalledWith(2);
    choosing = true;
    press("Digit2");
    press("Digit5");
    expect(held.choose).toHaveBeenCalledWith(1);
    expect(held.practise).toHaveBeenLastCalledWith(4);
  });
});

describe("a finger on the screen", () => {
  const attach = () => {
    const held = hands();
    let clock = 0;
    detach = attachTouch(byId("screen"), byId("main"), held, () => clock);
    return {
      held,
      later: (ms: number) => {
        clock += ms;
      },
    };
  };

  it("swipes to turn to who leads and taps to start, and leaves a mouse to the keys", () => {
    const { held } = attach();
    const screen = byId("screen");
    pointer(screen, "pointerdown", { x: 200, y: 100 });
    pointer(screen, "pointerup", { x: 120, y: 104 });
    pointer(screen, "pointerdown", { x: 100, y: 100 });
    pointer(screen, "pointerup", { x: 170, y: 100 });
    expect(held.turn).toHaveBeenNthCalledWith(1, 1);
    expect(held.turn).toHaveBeenNthCalledWith(2, -1);
    pointer(screen, "pointerdown", { x: 100, y: 100 });
    pointer(screen, "pointermove", { x: 104, y: 100 });
    pointer(screen, "pointerup", { x: 104, y: 100 });
    expect(held.start).toHaveBeenCalledOnce();
    pointer(screen, "pointerdown", { x: 100, y: 100 });
    pointer(screen, "pointerup", { x: 100, y: 130 });
    expect(held.start).toHaveBeenCalledOnce();
    expect(held.turn).toHaveBeenCalledTimes(2);
    pointer(screen, "pointerdown", { kind: "mouse" });
    pointer(screen, "pointerup", { kind: "mouse" });
    expect(held.start).toHaveBeenCalledOnce();
  });

  it("in a run, walks where it is dragged, acts on a tap, and breathes in while held still", () => {
    vi.useFakeTimers();
    running = true;
    const { held, later } = attach();
    const screen = byId("screen");
    pointer(screen, "pointerdown", { x: 100, y: 100 });
    pointer(screen, "pointermove", { x: 105, y: 98 });
    expect(held.steer).not.toHaveBeenCalled();
    pointer(screen, "pointermove", { x: 140, y: 60 });
    expect(held.steer).toHaveBeenLastCalledWith({ x: 40, y: 40 }, false);
    // Dragged further, it runs.
    pointer(screen, "pointermove", { x: 100 + runPixels, y: 100 });
    expect(held.steer).toHaveBeenLastCalledWith({ x: runPixels, y: 0 }, true);
    pointer(screen, "pointerup", { x: 140, y: 60 });
    expect(held.steer).toHaveBeenLastCalledWith(null, false);
    pointer(screen, "pointerdown", { id: 2, x: 50, y: 50 });
    pointer(screen, "pointermove", { id: 3, x: 90, y: 90 });
    later(80);
    pointer(screen, "pointerup", { id: 2, x: 50, y: 50 });
    expect(held.act).toHaveBeenNthCalledWith(1, true);
    expect(held.act).toHaveBeenNthCalledWith(2, false);
    pointer(screen, "pointerdown", { x: 50, y: 50 });
    vi.advanceTimersByTime(holdMs + 10);
    expect(held.act).toHaveBeenLastCalledWith(true);
    pointer(screen, "pointermove", { x: 120, y: 50 });
    pointer(screen, "pointerup", { x: 50, y: 50 });
    expect(held.act).toHaveBeenLastCalledWith(false);
    expect(held.act).toHaveBeenCalledTimes(4);
    pointer(screen, "pointerdown", { x: 50, y: 50 });
    later(holdMs + 50);
    pointer(screen, "pointercancel", { x: 50, y: 50 });
    expect(held.act).toHaveBeenCalledTimes(4);
  });

  it("presses the act key the moment a finger lands in a moment, on time for the beat", () => {
    running = true;
    inMoment = true;
    const { held } = attach();
    const screen = byId("screen");
    pointer(screen, "pointerdown");
    expect(held.act).toHaveBeenLastCalledWith(true);
    pointer(screen, "pointerdown", { id: 5 });
    pointer(screen, "pointerup");
    expect(held.act).toHaveBeenLastCalledWith(false);
    expect(held.act).toHaveBeenCalledTimes(2);
  });

  it("has four buttons in the corner: jump (in a moment, act, held), vision, practise and the share cards", () => {
    running = true;
    const { held } = attach();
    const buttons = [...byId("main").querySelectorAll(".touch-buttons button")];
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Jump",
      "Vision",
      "Practise",
      "Cards",
    ]);
    const [act, vision, practise, shared] = buttons;
    if (
      act === undefined ||
      vision === undefined ||
      practise === undefined ||
      shared === undefined
    )
      throw new Error("no buttons");
    pointer(shared, "pointerdown");
    pointer(shared, "pointerup");
    expect(held.cards).toHaveBeenCalledOnce();
    pointer(act, "pointerdown");
    pointer(act, "pointerup");
    expect(held.jump).toHaveBeenCalledOnce();
    inMoment = true;
    pointer(act, "pointerdown");
    pointer(act, "pointerup");
    inMoment = false;
    pointer(vision, "pointerdown");
    pointer(vision, "pointerup");
    pointer(practise, "pointerdown");
    pointer(practise, "pointerup");
    expect(held.act).toHaveBeenNthCalledWith(1, true);
    expect(held.act).toHaveBeenNthCalledWith(2, false);
    expect(held.vision).toHaveBeenCalledOnce();
    expect(held.practise).toHaveBeenCalledWith(-1);
    detach?.();
    detach = null;
    expect(byId("main").querySelectorAll(".touch-buttons")).toHaveLength(0);
  });
});
