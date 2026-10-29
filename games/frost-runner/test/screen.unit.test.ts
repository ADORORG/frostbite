// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { ticksPerSecond } from "../src/rules/constants.ts";
import { attachControls } from "../src/screen/controls.ts";
import { mostTicksAFrame, ticksIn } from "../src/screen/clock.ts";
import { draw, screenHeight, screenWidth } from "../src/screen/draw.ts";
import { colour } from "../src/screen/palette.ts";
import { empty, icicle, shard, spike, withWorld } from "./support/states.ts";

const frame = 1000 / ticksPerSecond;

describe("turning time into ticks", () => {
  it("gives a whole tick for each thirtieth of a second and keeps the rest for the next frame", () => {
    expect(ticksIn(0, frame * 2.5).ticks).toBe(2);
    const second = ticksIn(ticksIn(0, frame * 2.5).carried, frame * 0.6);
    expect(second.ticks).toBe(1);
    expect(ticksIn(0, 5).ticks).toBe(0);
    expect(ticksIn(0, 5).carried).toBeCloseTo(5);
  });

  it("ignores time running backwards, and cuts a long pause short instead of running the runner into a wall", () => {
    expect(ticksIn(0, -50)).toEqual({ carried: 0, ticks: 0 });
    expect(ticksIn(0, 60_000)).toEqual({ carried: 0, ticks: mostTicksAFrame });
  });
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
    const controls = { jump: vi.fn(), slide: vi.fn() };
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
    const controls = { jump: vi.fn(), slide: vi.fn() };
    const stop = attachControls(target, controls);
    stop();
    press("Space");
    target.dispatchEvent(new MouseEvent("pointerdown", { clientY: 0 }));
    expect(controls.jump).not.toHaveBeenCalled();
  });
});

// A drawing surface that notes what is drawn on it.
function surface() {
  const drawn: {
    fill: string;
    height: number;
    width: number;
    x: number;
    y: number;
  }[] = [];
  const context = {
    fillRect(x: number, y: number, width: number, height: number) {
      drawn.push({ fill: String(context.fillStyle), height, width, x, y });
    },
    fillStyle: "",
  };
  return { context: context as unknown as CanvasRenderingContext2D, drawn };
}

describe("drawing the screen", () => {
  it("fills the whole screen with the sky first, and stays inside it", () => {
    const { context, drawn } = surface();
    draw(
      context,
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

  it("draws each kind of thing in its own colour", () => {
    const { context, drawn } = surface();
    draw(context, withWorld([spike(60), icicle(120)], [shard(40)]), 500);
    const fills = new Set(drawn.map(({ fill }) => fill));
    for (const wanted of [colour.pink, colour.core, colour.yellow, colour.cyan])
      expect(fills).toContain(wanted);
  });

  it("draws the runner in red once it is stopped, and lower while sliding", () => {
    const alive = surface();
    draw(alive.context, empty(), 100);
    const dead = surface();
    draw(dead.context, { ...empty(), alive: false }, 100);
    expect(alive.drawn.some(({ fill }) => fill === colour.cyan)).toBe(true);
    expect(dead.drawn.some(({ fill }) => fill === colour.red)).toBe(true);
    const slide = surface();
    draw(
      slide.context,
      { ...empty(), action: { kind: "slide", tick: 2 } },
      100,
    );
    const body = (list: ReturnType<typeof surface>["drawn"]) =>
      list.find(({ fill }) => fill === colour.cyan);
    expect(body(slide.drawn)?.height).toBeLessThan(
      body(alive.drawn)?.height ?? 0,
    );
  });

  it("raises the runner in a jump", () => {
    const ground = surface();
    draw(ground.context, empty(), 100);
    const air = surface();
    draw(air.context, { ...empty(), action: { kind: "jump", tick: 12 } }, 100);
    const top = (list: ReturnType<typeof surface>["drawn"]) =>
      list.find(({ fill }) => fill === colour.cyan)?.y ?? 0;
    expect(top(air.drawn)).toBeLessThan(top(ground.drawn));
  });

  it("shows how far along the best distance the run is, never beyond the bar", () => {
    const run = surface();
    draw(run.context, { ...empty(), distance: 10_000 }, 100);
    const bar = run.drawn.filter(
      ({ fill, y }) => fill === colour.yellow && y === 2,
    );
    expect(bar.at(-1)?.width).toBeLessThanOrEqual(screenWidth - 4);
    const none = surface();
    draw(none.context, empty(), 0);
    expect(
      none.drawn.find(({ fill, y }) => fill === colour.yellow && y === 2),
    ).toBeUndefined();
  });
});
