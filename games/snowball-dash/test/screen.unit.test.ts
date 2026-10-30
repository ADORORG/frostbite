// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachControls } from "../src/screen/controls.ts";
import { draw, screenHeight, screenWidth } from "../src/screen/draw.ts";
import { colour } from "../src/screen/palette.ts";
import { withRocks } from "./support/states.ts";

const actions = () => ({ hop: vi.fn(), pause: vi.fn(), start: vi.fn() });

describe("the player's hands", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });
  function setup() {
    const target = document.createElement("div");
    document.body.append(target);
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

  it("hops on Space and the up arrow, starts on Enter, and pauses on P (and never on Space)", () => {
    const { controls } = setup();
    press("Space");
    press("ArrowUp");
    expect(controls.hop).toHaveBeenCalledTimes(2);
    press("Enter");
    press("NumpadEnter");
    expect(controls.start).toHaveBeenCalledTimes(2);
    press("KeyP");
    expect(controls.pause).toHaveBeenCalledTimes(1);
  });

  it("holds a key down without repeating, and ignores keys it does not know and shortcuts", () => {
    const { controls } = setup();
    expect(press("Space", true).defaultPrevented).toBe(true);
    press("KeyQ");
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Space", ctrlKey: true }),
    );
    expect(controls.hop).not.toHaveBeenCalled();
  });

  it("hops on a touch anywhere on the screen, and stops listening when told", () => {
    const { controls, target } = setup();
    const event = new MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    expect(controls.hop).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    for (const stop of stops.splice(0)) stop();
    target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    press("Space");
    expect(controls.hop).toHaveBeenCalledTimes(1);
  });
});

// A canvas context that notes the fills it was asked for.
function recorder() {
  const fills: {
    fill: string;
    height: number;
    width: number;
    x: number;
    y: number;
  }[] = [];
  const context = {
    fillRect(x: number, y: number, width: number, height: number) {
      fills.push({ fill: String(context.fillStyle), height, width, x, y });
    },
    fillStyle: "",
  };
  return { context: context as unknown as CanvasRenderingContext2D, fills };
}
const colours = (fills: { fill: string }[]) =>
  new Set(fills.map(({ fill }) => fill));

describe("the screen", () => {
  it("draws the sky, the snow, the snowball and the progress, all inside the screen", () => {
    const { context, fills } = recorder();
    draw(context, withRocks([]));
    for (const used of [colour.sky, colour.snow, colour.ball, colour.yellow])
      expect(colours(fills)).toContain(used);
    for (const { height, width, x, y } of fills) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(screenWidth);
      expect(y + height).toBeLessThanOrEqual(screenHeight);
    }
  });

  it("draws a rock only while it is on the screen", () => {
    const near = recorder();
    draw(near.context, withRocks([200]));
    expect(colours(near.fills)).toContain(colour.rock);
    const far = recorder();
    draw(far.context, withRocks([5_000]));
    expect(colours(far.fills)).not.toContain(colour.rock);
    const gone = recorder();
    draw(gone.context, withRocks([100], { distance: 2_000 }));
    expect(colours(gone.fills)).not.toContain(colour.rock);
  });

  it("lifts the snowball in a hop", () => {
    const ground = recorder();
    draw(ground.context, withRocks([]));
    const air = recorder();
    draw(air.context, withRocks([], { air: 11 }));
    const top = (r: ReturnType<typeof recorder>) =>
      Math.min(
        ...r.fills.filter(({ fill }) => fill === colour.ball).map(({ y }) => y),
      );
    expect(top(air)).toBeLessThan(top(ground));
  });

  it("fills the progress bar as far down as the snowball has come, and flashes red when it is struck", () => {
    const start = recorder();
    draw(start.context, withRocks([]));
    const half = recorder();
    draw(half.context, withRocks([], { distance: 3_000 }));
    const bar = (r: ReturnType<typeof recorder>) =>
      r.fills.find(({ fill, y }) => fill === colour.yellow && y === 2)?.width ??
      -1;
    expect(bar(start)).toBe(0);
    expect(bar(half)).toBe(76);
    const hit = recorder();
    draw(hit.context, withRocks([], { alive: false }));
    expect(colours(hit.fills)).toContain(colour.flash);
    expect(colours(start.fills)).not.toContain(colour.flash);
  });
});
