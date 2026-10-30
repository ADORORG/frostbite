// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachControls } from "../src/screen/controls.ts";
import { draw, screenHeight, screenWidth } from "../src/screen/draw.ts";
import { colour } from "../src/screen/palette.ts";
import type { RunnerState } from "../src/rules/types.ts";
import { empty, icicle, shard, spike, withWorld } from "./support/states.ts";

const actions = () => ({
  jump: vi.fn(),
  pause: vi.fn(),
  slide: vi.fn(),
  start: vi.fn(),
});

describe("the player's hands", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });

  function setup() {
    const target = document.createElement("div");
    document.body.append(target);
    target.getBoundingClientRect = () => ({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const controls = actions();
    stops.push(attachControls(target, controls));
    return { controls, target };
  }
  const press = (code: string, repeat = false) => {
    const event = new KeyboardEvent("keydown", {
      cancelable: true,
      code,
      repeat,
    });
    window.dispatchEvent(event);
    return event;
  };
  const touch = (target: HTMLElement, clientY: number) => {
    const event = new MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      clientY,
    });
    target.dispatchEvent(event);
    return event;
  };

  it("jumps on up, W and space, and slides on down, S and shift", () => {
    const { controls } = setup();
    for (const code of ["ArrowUp", "KeyW", "Space"]) press(code);
    expect(controls.jump).toHaveBeenCalledTimes(3);
    for (const code of ["ArrowDown", "KeyS", "ShiftLeft", "ShiftRight"])
      press(code);
    expect(controls.slide).toHaveBeenCalledTimes(4);
  });

  it("starts on Enter and pauses on P, and leaves Space to the jump", () => {
    const { controls } = setup();
    press("Enter");
    press("NumpadEnter");
    press("KeyP");
    expect(controls.start).toHaveBeenCalledTimes(2);
    expect(controls.pause).toHaveBeenCalledTimes(1);
    expect(controls.jump).not.toHaveBeenCalled();
  });

  it("acts when a key goes down, not when it comes up", () => {
    const { controls } = setup();
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    expect(controls.start).not.toHaveBeenCalled();
    expect(controls.jump).not.toHaveBeenCalled();
  });

  it("takes over only the keys it uses, and not a key that is held down", () => {
    const { controls } = setup();
    expect(press("KeyQ").defaultPrevented).toBe(false);
    expect(press("Space").defaultPrevented).toBe(true);
    press("Space", true);
    expect(controls.jump).toHaveBeenCalledTimes(1);
  });

  it("jumps on a touch in the top half of the screen, and slides on one in the bottom half", () => {
    const { controls, target } = setup();
    expect(touch(target, 10).defaultPrevented).toBe(true);
    touch(target, 49);
    expect(controls.jump).toHaveBeenCalledTimes(2);
    touch(target, 50);
    touch(target, 90);
    expect(controls.slide).toHaveBeenCalledTimes(2);
  });

  it("stops listening when told to", () => {
    const target = document.createElement("div");
    const controls = actions();
    const stop = attachControls(target, controls);
    stop();
    press("Space");
    target.dispatchEvent(new MouseEvent("pointerdown", { clientY: 0 }));
    expect(controls.jump).not.toHaveBeenCalled();
  });
});

// A drawing surface that notes what is drawn on it.
type Drawn = {
  fill: string;
  height: number;
  width: number;
  x: number;
  y: number;
};
function surface() {
  const drawn: Drawn[] = [];
  const context = {
    fillRect(x: number, y: number, width: number, height: number) {
      drawn.push({ fill: String(context.fillStyle), height, width, x, y });
    },
    fillStyle: "",
  };
  return { context: context as unknown as CanvasRenderingContext2D, drawn };
}
const painted = (state: RunnerState, best = 100) => {
  const page = surface();
  draw(page.context, state, best);
  return page.drawn;
};
const ofColour = (list: readonly Drawn[], fill: string) =>
  list.filter((block) => block.fill === fill);
const top = (list: readonly Drawn[], fill: string) =>
  Math.min(...ofColour(list, fill).map(({ y }) => y));

describe("drawing the screen", () => {
  it("fills the whole screen with the sky first, and stays inside it", () => {
    const drawn = painted(
      withWorld([spike(60), icicle(120)], [shard(40), shard(80, true)]),
      500,
    );
    expect(drawn[0]).toEqual({
      fill: colour.background,
      height: screenHeight,
      width: screenWidth,
      x: 0,
      y: 0,
    });
    for (const block of drawn) {
      expect(
        Number.isFinite(block.x + block.y + block.width + block.height),
      ).toBe(true);
      expect(block.width).toBeGreaterThan(0);
      expect(block.height).toBeGreaterThan(0);
    }
  });

  it("draws the same picture for the same state, and another as the ticks go by", () => {
    const run = withWorld([spike(60)], [shard(40)]);
    expect(painted(run)).toEqual(painted(run));
    expect(painted({ ...run, tick: 37 })).not.toEqual(painted(run));
  });

  it("draws each kind of thing in its own colour", () => {
    const fills = new Set(
      painted(withWorld([spike(60), icicle(120)], [shard(40)])).map(
        ({ fill }) => fill,
      ),
    );
    for (const wanted of [
      colour.pink,
      colour.frost,
      colour.yellow,
      colour.cyan,
    ])
      expect(fills).toContain(wanted);
  });

  it("draws the runner in red once it is stopped, with the screen flashing red, and not before", () => {
    const alive = painted(empty());
    const dead = painted({ ...empty(), alive: false });
    expect(ofColour(alive, colour.cyan).length).toBeGreaterThan(0);
    expect(ofColour(alive, colour.flash)).toEqual([]);
    expect(ofColour(dead, colour.red).length).toBeGreaterThan(0);
    expect(ofColour(dead, colour.flash)).toHaveLength(1);
    expect(ofColour(dead, colour.flash)[0]).toMatchObject({
      height: screenHeight,
      width: screenWidth,
    });
  });

  it("runs on two frames of legs, a tuck in the air and a low slide, each its own picture", () => {
    const legs = (tick: number) =>
      JSON.stringify(
        ofColour(painted({ ...empty(), tick }), colour.deep).filter(
          ({ y }) => y > 60,
        ),
      );
    expect(legs(0)).not.toBe(legs(4));
    expect(legs(0)).toBe(legs(8));
    const standing = ofColour(painted(empty()), colour.cyan).length;
    const sliding = ofColour(
      painted({ ...empty(), action: { kind: "slide", tick: 2 } }),
      colour.cyan,
    ).length;
    expect(sliding).toBeLessThan(standing);
    const tucked = painted({ ...empty(), action: { kind: "jump", tick: 12 } });
    expect(ofColour(tucked, colour.cyan).length).not.toBe(standing);
  });

  it("raises the runner in a jump, and lowers its shadow's size", () => {
    expect(
      top(
        painted({ ...empty(), action: { kind: "jump", tick: 12 } }),
        colour.cyan,
      ),
    ).toBeLessThan(top(painted(empty()), colour.cyan));
    const shadow = (state: RunnerState) =>
      ofColour(painted(state), colour.shadow)[0]?.width ?? 0;
    expect(
      shadow({ ...empty(), action: { kind: "jump", tick: 12 } }),
    ).toBeLessThan(shadow(empty()));
  });

  it("makes a shard glint, a spike a crystal, and an icicle glint at its tip now and then", () => {
    const frames = (tick: number) =>
      JSON.stringify(
        ofColour(painted({ ...withWorld([], [shard(40)]), tick }), colour.core),
      );
    expect(frames(0)).not.toBe(frames(6));
    expect(
      ofColour(painted(withWorld([spike(60)])), colour.red).length,
    ).toBeGreaterThan(0);
    const tip = (tick: number) =>
      ofColour(painted({ ...withWorld([icicle(60)]), tick }), colour.core)
        .length;
    expect(tip(0)).toBeGreaterThan(tip(10));
  });

  it("shows how far along the best distance the run is, never beyond the bar", () => {
    const bar = (state: RunnerState, best: number) =>
      ofColour(painted(state, best), colour.yellow).filter(
        ({ y, height }) => y === 2 && height === 2,
      );
    expect(
      bar({ ...empty(), distance: 10_000 }, 100).at(-1)?.width,
    ).toBeLessThanOrEqual(screenWidth - 4);
    expect(bar(empty(), 0)).toEqual([]);
  });

  it("lets the world go faster the further the runner has got: streaks of speed only at speed", () => {
    const streaks = (distance: number) =>
      ofColour(painted({ ...empty(), distance }), colour.groundLight).length;
    expect(streaks(40_000)).toBeGreaterThan(streaks(0));
  });

  it("moves the layers at their own speeds: far hills slower than near ones", () => {
    const ridge = (distance: number) =>
      JSON.stringify(
        ofColour(painted({ ...empty(), distance }), colour.cloud).slice(0, 40),
      );
    expect(ridge(0)).not.toBe(ridge(4_000));
  });
});
