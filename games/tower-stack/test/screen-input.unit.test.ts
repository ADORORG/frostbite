// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { ticksPerSecond } from "../src/rules/constants.ts";
import { cameraTarget, easeCamera } from "../src/screen/camera.ts";
import { mostTicksAFrame, ticksIn } from "../src/screen/clock.ts";
import { attachControls } from "../src/screen/controls.ts";
import { rowsInView, slabHeight } from "../src/screen/layout.ts";

describe("turning time into ticks", () => {
  it("runs at the rate of the rules, a tick for each thirtieth of a second, and cuts a long pause short", () => {
    const frame = 1000 / ticksPerSecond;
    expect(ticksIn(0, frame * 2.5).ticks).toBe(2);
    expect(ticksIn(0, 60_000)).toEqual({ carried: 0, ticks: mostTicksAFrame });
  });
});

describe("the view rising with the tower", () => {
  it("stays put until the tower is as high as the view, then rises a block for each block", () => {
    expect(cameraTarget(0)).toBe(0);
    expect(cameraTarget(rowsInView)).toBe(0);
    expect(cameraTarget(rowsInView + 3)).toBe(3 * slabHeight);
  });

  it("climbs toward its target, faster when far behind, never past it, and never back down", () => {
    expect(easeCamera(0, 60)).toBe(12);
    expect(easeCamera(0, 3)).toBe(1);
    expect(easeCamera(59, 60)).toBe(60);
    expect(easeCamera(60, 60)).toBe(60);
    expect(easeCamera(80, 60)).toBe(60);
  });
});

describe("the player's hands", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });
  const setup = () => {
    const target = document.createElement("div");
    document.body.append(target);
    const drop = vi.fn();
    stops.push(attachControls(target, { drop }));
    return { drop, target };
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

  it.each(["Space", "Enter", "ArrowDown", "KeyS"])(
    "drops on %s, and the page does not scroll",
    (code) => {
      const { drop } = setup();
      expect(press(code).defaultPrevented).toBe(true);
      expect(drop).toHaveBeenCalledTimes(1);
    },
  );

  it("ignores a held key, and a key that is not for the game", () => {
    const { drop } = setup();
    press("Space", true);
    expect(press("KeyQ").defaultPrevented).toBe(false);
    expect(drop).not.toHaveBeenCalled();
  });

  it("drops on a touch or a click anywhere on the screen", () => {
    const { drop, target } = setup();
    target.dispatchEvent(
      new Event("pointerdown", { bubbles: true, cancelable: true }),
    );
    expect(drop).toHaveBeenCalledTimes(1);
  });

  it("stops listening when it is told to", () => {
    const { drop, target } = setup();
    for (const stop of stops.splice(0)) stop();
    press("Space");
    target.dispatchEvent(new Event("pointerdown"));
    expect(drop).not.toHaveBeenCalled();
  });
});
