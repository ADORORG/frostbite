// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { button } from "../src/rules/constants.ts";
import { attachControls, type Mode } from "../src/ui/controls.ts";
import { createPadReader } from "../src/ui/pad.ts";
import { touchLabels } from "../src/words.ts";
import { byId, loadPage } from "./support/dom.ts";

beforeEach(loadPage);

const key = (code: string, phase: "keydown" | "keyup" = "keydown") =>
  window.dispatchEvent(new KeyboardEvent(phase, { code }));
const pointer = (
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  pointerType = "touch",
) => {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperties(event, {
    pointerId: { value: 7 },
    pointerType: { value: pointerType },
  });
  target.dispatchEvent(event);
};

const setUp = (mode: Mode, ready = { grow: true, vision: false }) => {
  const events = {
    mode: vi.fn(() => mode),
    pause: vi.fn(),
    ready: vi.fn(() => ready),
    start: vi.fn(),
    turn: vi.fn(),
  };
  const controls = attachControls(
    byId("stage", HTMLElement),
    byId("main", HTMLElement),
    events,
  );
  return { controls, events };
};

describe("the hands", () => {
  it("steer and press with the keys, and start, pause and turn the hero ring", () => {
    const { controls, events } = setUp("play");
    key("KeyD");
    key("KeyW");
    expect(controls.way()).toBe(2);
    key("Space");
    key("ShiftLeft");
    key("KeyF");
    key("KeyG");
    key("KeyV");
    expect(controls.buttons()).toBe(
      button.hop | button.duck | button.shoot | button.grow | button.vision,
    );
    key("Space", "keyup");
    expect(controls.buttons() & button.hop).toBe(0);
    key("KeyD", "keyup");
    key("KeyW", "keyup");
    expect(controls.way()).toBe(-1);
    key("KeyP");
    key("Enter");
    expect(events.pause).toHaveBeenCalledOnce();
    expect(events.start).toHaveBeenCalledOnce();
    events.mode.mockReturnValue("select");
    key("ArrowLeft");
    key("ArrowRight");
    key("Space");
    expect(events.turn.mock.calls).toEqual([[-1], [1]]);
    expect(events.start).toHaveBeenCalledTimes(2);
  });

  it("steer with a drag anywhere on the screen, and turn the ring with a swipe on the select", () => {
    const { controls, events } = setUp("play");
    const screen = byId("screen", HTMLCanvasElement);
    pointer(screen, "pointerdown", 100, 100, "mouse");
    expect(document.querySelector(".stick")?.classList).not.toContain("on");
    pointer(screen, "pointerdown", 100, 100);
    expect(document.querySelector(".stick")?.classList).toContain("on");
    pointer(window, "pointermove", 160, 100);
    expect(controls.way()).toBe(4);
    pointer(window, "pointermove", 104, 100);
    expect(controls.way()).toBe(-1);
    pointer(window, "pointerup", 104, 100);
    expect(document.querySelector(".stick")?.classList).not.toContain("on");
    events.mode.mockReturnValue("select");
    pointer(screen, "pointerdown", 200, 100);
    pointer(window, "pointermove", 120, 104);
    pointer(window, "pointermove", 60, 104);
    pointer(window, "pointercancel", 60, 104);
    expect(events.turn.mock.calls).toEqual([[1]]);
  });

  it("turn the ring with a swipe on the select's card too, and let no tap through after a swipe", () => {
    const { events } = setUp("select");
    const card = byId("select", HTMLElement);
    const taps = vi.fn();
    card.addEventListener("click", taps);
    pointer(card, "pointerdown", 300, 100);
    pointer(window, "pointermove", 360, 102);
    pointer(window, "pointerup", 360, 102);
    expect(events.turn.mock.calls).toEqual([[-1]]);
    card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(taps).not.toHaveBeenCalled();
    // A tap that follows (no swipe before it) reaches the card as usual.
    pointer(card, "pointerdown", 300, 100);
    pointer(window, "pointerup", 300, 100);
    card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(taps).toHaveBeenCalledOnce();
  });

  it("give the touch screen four thumb buttons from the start, dimming those the round has not taught", () => {
    const { controls } = setUp("play", { grow: false, vision: true });
    const thumbs = [
      ...document.querySelectorAll<HTMLButtonElement>(".touch-buttons button"),
    ];
    expect(thumbs.map((thumb) => thumb.textContent)).toEqual([
      touchLabels.hop,
      touchLabels.duck,
      touchLabels.shoot,
      touchLabels.grow,
    ]);
    controls.forRound(0);
    expect(thumbs.map((thumb) => thumb.getAttribute("aria-disabled"))).toEqual([
      "false",
      "false",
      "true",
      "true",
    ]);
    controls.forRound(2);
    expect(
      thumbs.every((thumb) => thumb.getAttribute("aria-disabled") === "false"),
    ).toBe(true);
    controls.poll();
    expect(thumbs[3]?.textContent).toBe(touchLabels.see);
    const press = (thumb: HTMLButtonElement | undefined) =>
      thumb?.dispatchEvent(new MouseEvent("click", { detail: 0 }));
    const power = thumbs[3];
    press(thumbs[0]);
    press(power);
    expect(controls.buttons()).toBe(0);
  });

  it("read a gamepad: the stick and buttons in a run, turning and choosing on the select, Start to pause", () => {
    const mode = { now: "play" as Mode };
    const events = {
      mode: () => mode.now,
      pause: vi.fn(),
      start: vi.fn(),
      turn: vi.fn(),
    };
    const read = createPadReader(events);
    const pad = (axes: number[], pressed: number[]) => ({
      axes,
      buttons: Array.from({ length: 16 }, (_, at) => ({
        pressed: pressed.includes(at),
      })),
      connected: true,
    });
    expect(read([])).toEqual({ buttons: 0, way: -1 });
    expect(read([null, pad([1, 0], [0, 1, 2, 3, 4])])).toEqual({
      buttons:
        button.hop | button.duck | button.shoot | button.grow | button.vision,
      way: 4,
    });
    expect(read([pad([0, 0], [15, 12])]).way).toBe(2);
    read([pad([0, 0], [9])]);
    read([pad([0, 0], [9])]);
    expect(events.pause).toHaveBeenCalledOnce();
    mode.now = "select";
    read([pad([0.9, 0], [])]);
    read([pad([0.9, 0], [])]);
    read([pad([-0.9, 0], [0])]);
    read([pad([0, 0], [])]);
    read([pad([0, 0], [9])]);
    expect(events.turn.mock.calls).toEqual([[1], [-1]]);
    expect(events.start).toHaveBeenCalledTimes(2);
    mode.now = "wait";
    expect(read([pad([0.9, 0], [13])])).toEqual({ buttons: 0, way: -1 });
  });
});
