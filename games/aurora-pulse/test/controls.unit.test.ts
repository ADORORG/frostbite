// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachControls, laneOfTouch } from "../src/screen/controls.ts";
import {
  fieldX,
  hitY,
  laneAt,
  laneWidth,
  laneX,
  noteY,
  screenWidth,
  topY,
} from "../src/screen/layout.ts";

describe("the screen's measures", () => {
  it("puts a touch on the lane that is drawn there, and the margins on the lane beside them", () => {
    const lane = (index: number) => laneX(index) + laneWidth / 2;
    expect([0, 1, 2, 3].map((index) => laneAt(lane(index)))).toEqual([
      0, 1, 2, 3,
    ]);
    expect([0, fieldX - 1, laneX(1) - 1, laneX(1)].map(laneAt)).toEqual([
      0, 0, 0, 1,
    ]);
    expect([laneX(4) - 1, laneX(4), screenWidth, 400, -5].map(laneAt)).toEqual([
      3, 3, 3, 3, 0,
    ]);
    expect(laneOfTouch(0.49)).toBe(1);
    expect(laneOfTouch(0.5)).toBe(2);
    expect(laneOfTouch(1)).toBe(3);
  });

  it("puts a note on the line when it is due, at the top when it comes in, and under the line once it has gone by", () => {
    expect(noteY(0, 96)).toBe(hitY);
    expect(noteY(96, 96)).toBe(topY);
    expect(noteY(48, 96)).toBe((hitY + topY) / 2);
    expect(noteY(-4, 96)).toBeGreaterThan(hitY);
  });
});

describe("the player's hands", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });
  const setup = () => {
    const screen = document.createElement("canvas");
    screen.getBoundingClientRect = () => ({
      bottom: 360,
      height: 360,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    });
    const handlers = { lane: vi.fn(), pause: vi.fn(), start: vi.fn() };
    stops.push(attachControls(screen, handlers));
    return { handlers, screen };
  };
  const press = (code: string, repeat = false) => {
    const event = new KeyboardEvent("keydown", {
      cancelable: true,
      code,
      repeat,
    });
    window.dispatchEvent(event);
    return event;
  };

  it("taps a lane on D F J K and on the arrow keys, and takes over only those keys", () => {
    const { handlers } = setup();
    const pairs = [
      ["KeyD", 0],
      ["KeyF", 1],
      ["KeyJ", 2],
      ["KeyK", 3],
      ["ArrowLeft", 0],
      ["ArrowDown", 1],
      ["ArrowUp", 2],
      ["ArrowRight", 3],
    ] as const;
    for (const [code, lane] of pairs) {
      expect(press(code).defaultPrevented).toBe(true);
      expect(handlers.lane).toHaveBeenLastCalledWith(lane);
    }
    expect(handlers.lane).toHaveBeenCalledTimes(pairs.length);
    expect(press("KeyQ").defaultPrevented).toBe(false);
    press("KeyD", true);
    expect(handlers.lane).toHaveBeenCalledTimes(pairs.length);
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyD" }));
    expect(handlers.lane).toHaveBeenCalledTimes(pairs.length);
  });

  it("starts on Enter, and pauses on P and on Space", () => {
    const { handlers } = setup();
    press("Enter");
    press("NumpadEnter");
    press("KeyP");
    press("Space");
    expect(handlers.start).toHaveBeenCalledTimes(2);
    expect(handlers.pause).toHaveBeenCalledTimes(2);
    expect(handlers.lane).not.toHaveBeenCalled();
  });

  it("taps the lane a touch lands in, each touch on its own, so two fingers are two taps", () => {
    const { handlers, screen } = setup();
    screen.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 10, clientY: 300 }),
    );
    screen.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 630, clientY: 20 }),
    );
    expect(handlers.lane.mock.calls).toEqual([[0], [3]]);
  });

  it("plays the lane a finger landed on once, and not again as the finger slides across the others", () => {
    const { handlers, screen } = setup();
    const send = (type: string, x: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX: x });
      Object.assign(event, { pointerId: 1, pointerType: "touch" });
      (type === "pointerdown" ? screen : window).dispatchEvent(event);
    };
    document.body.append(screen);
    send("pointerdown", 10);
    send("pointermove", 320);
    send("pointermove", 630);
    send("pointerup", 630);
    expect(handlers.lane.mock.calls).toEqual([[0]]);
  });

  it("stops listening when told to", () => {
    const screen = document.createElement("canvas");
    const handlers = { lane: vi.fn(), pause: vi.fn(), start: vi.fn() };
    const stop = attachControls(screen, handlers);
    stop();
    press("KeyD");
    screen.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 10, clientY: 10 }),
    );
    expect(handlers.lane).not.toHaveBeenCalled();
  });
});
