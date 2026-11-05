// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachTapToStart, settleMs, tapMs } from "../src/page/tap-start.ts";
import {
  attachThumbs,
  createHeld,
  restShare,
  stickMiddle,
  thumbAt,
  upright,
} from "../src/page/thumbs.ts";
import { attachZones } from "../src/page/zones.ts";

// Thumbs on the screen, driven the way a phone drives them: pointer events, one finger at a time or several at once.
const stops: (() => void)[] = [];
let stage: HTMLDivElement;
beforeEach(() => {
  document.body.innerHTML =
    '<div id="stage"><canvas></canvas><button type="button">Bag</button></div>';
  const found = document.getElementById("stage");
  if (!(found instanceof HTMLDivElement)) throw new Error("no stage");
  stage = found;
  // A phone held upright: the stage is 390 by 470 and starts 40 down the page.
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ height: 470, width: 390, x: 0, y: 40 }),
  );
});
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.restoreAllMocks();
});

const finger = (
  type: string,
  id: number,
  x: number,
  y: number,
  options: { readonly on?: Element; readonly pointerType?: string } = {},
) =>
  (options.on ?? stage.querySelector("canvas") ?? stage).dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType: options.pointerType ?? "touch",
    }),
  );

describe("where a thumb is", () => {
  it("is a stick of eight ways on the left, with a resting middle, and act and fire on the right", () => {
    // Upright: the picture is 390 by 219 at the top, and the stick's middle is halfway down the room under it.
    expect(upright(390, 470)).toBe(true);
    const middle = stickMiddle(390, 470);
    expect(middle.x).toBeCloseTo(97.5);
    expect(middle.y).toBeCloseTo((390 / (16 / 9) + 470) / 2);
    const at = (dx: number, dy: number) =>
      thumbAt(middle.x + dx, middle.y + dy, 390, 470);
    expect(at(0, 0)).toBeNull();
    const rest = restShare * 390;
    expect(at(rest - 1, 0)).toBeNull();
    expect(at(rest + 1, 0)).toBe("right");
    expect(
      [
        [60, 0],
        [60, 60],
        [0, 60],
        [-60, 60],
        [-60, 0],
        [-60, -60],
        [0, -60],
        [60, -60],
      ].map(([dx = 0, dy = 0]) => at(dx, dy)),
    ).toEqual([
      "right",
      "down-right",
      "down",
      "down-left",
      "left",
      "up-left",
      "up",
      "up-right",
    ]);
    // A slant is a slant only past an eighth of a turn from the straight way.
    expect(at(60, 24)).toBe("right");
    expect(at(60, 26)).toBe("down-right");
    // Upright, the outer quarter acts and the inner quarter fires, from top to bottom.
    expect(thumbAt(195, 10, 390, 470)).toBe("fire");
    expect(thumbAt(292, 460, 390, 470)).toBe("fire");
    expect(thumbAt(293, 460, 390, 470)).toBe("act");
    expect(thumbAt(389, 10, 390, 470)).toBe("act");
  });

  it("on a stage held on its side, has the stick in the room left of the picture and acts above and fires below", () => {
    expect(upright(750, 150)).toBe(false);
    // The picture is 267 wide in the middle, leaving 242 either side: the stick is in the middle of the left room.
    const middle = stickMiddle(750, 150);
    expect(middle).toEqual({ x: (750 - 150 * (16 / 9)) / 4, y: 75 });
    expect(thumbAt(middle.x - 30, 75, 750, 150)).toBe("left");
    expect(thumbAt(middle.x, 10, 750, 150)).toBe("up");
    // A box just wider than the picture: the stick is an eighth of the way in.
    expect(stickMiddle(400, 220).x).toBe(50);
    expect(thumbAt(375, 74, 750, 150)).toBe("act");
    expect(thumbAt(700, 75, 750, 150)).toBe("fire");
  });
});

describe("thumbs on the screen", () => {
  it("hold what each finger's zone means, follow each finger on its own, and let go when it lifts or is called away", () => {
    const hold = vi.fn();
    stops.push(attachThumbs(stage, hold));
    const middle = stickMiddle(390, 470);
    const y = middle.y + 40;
    finger("pointerdown", 1, middle.x + 60, y);
    expect(hold.mock.calls).toEqual([["right", true]]);
    finger("pointermove", 1, middle.x + 62, y + 2);
    expect(hold).toHaveBeenCalledTimes(1);
    finger("pointermove", 1, middle.x + 60, y - 60);
    expect(hold.mock.calls.slice(1)).toEqual([
      ["right", false],
      ["up", true],
      ["right", true],
    ]);
    finger("pointerdown", 2, 360, y);
    expect(hold).toHaveBeenLastCalledWith("act", true);
    finger("pointermove", 2, 250, y);
    expect(hold.mock.calls.slice(-2)).toEqual([
      ["act", false],
      ["fire", true],
    ]);
    finger("pointerup", 2, 250, y);
    expect(hold).toHaveBeenLastCalledWith("fire", false);
    finger("pointercancel", 1, 0, 0);
    expect(hold.mock.calls.slice(-2)).toEqual([
      ["up", false],
      ["right", false],
    ]);
    finger("pointerdown", 3, middle.x - 60, y);
    window.dispatchEvent(new Event("blur"));
    expect(hold.mock.calls.slice(-2)).toEqual([
      ["left", true],
      ["left", false],
    ]);
    // A finger the page has lost track of, and one that never came down, change nothing.
    finger("pointermove", 3, middle.x + 60, y);
    finger("pointerup", 9, middle.x + 60, y);
    expect(hold.mock.calls).toHaveLength(12);
  });

  it("leave a mouse and a press on a button over the screen alone, and stop listening when told", () => {
    const hold = vi.fn();
    const stop = attachThumbs(stage, hold);
    finger("pointerdown", 1, 360, 300, { pointerType: "mouse" });
    const bag = stage.querySelector("button");
    if (bag === null) throw new Error("no button");
    finger("pointerdown", 2, 360, 300, { on: bag });
    expect(hold).not.toHaveBeenCalled();
    finger("pointerdown", 3, 360, 300, { pointerType: "pen" });
    expect(hold).toHaveBeenLastCalledWith("act", true);
    stop();
    expect(hold).toHaveBeenLastCalledWith("act", false);
    finger("pointerdown", 4, 360, 300);
    expect(hold).toHaveBeenCalledTimes(2);
  });

  it("keep an action held while any finger holds it", () => {
    const hold = vi.fn();
    const held = createHeld(hold);
    held.press(["up", "left"]);
    held.press(["left"]);
    held.release(["left"]);
    expect(hold.mock.calls).toEqual([
      ["up", true],
      ["left", true],
    ]);
    held.release(["up", "left"]);
    held.release(["left"]);
    expect(hold.mock.calls.slice(2)).toEqual([
      ["up", false],
      ["left", false],
    ]);
  });

  it("pass the zone and the box to the zones' sums, measured from the surface's corner", () => {
    const at = vi.fn(() => null);
    stops.push(attachZones(stage, { at, enter: vi.fn(), leave: vi.fn() }));
    finger("pointerdown", 1, 30, 100);
    expect(at).toHaveBeenCalledWith(30, 60, 390, 470);
  });
});

describe("a tap on the screen", () => {
  const tapping = (canStart: () => boolean) => {
    let now = 10_000;
    const start = vi.fn();
    stops.push(attachTapToStart(stage, { canStart, now: () => now, start }));
    const tap = (id: number, held = 100, moved = 0) => {
      finger("pointerdown", id, 100, 100);
      now += held;
      finger("pointerup", id, 100 + moved, 100);
    };
    return {
      start,
      tap,
      wait: (ms: number) => void (now += ms),
    };
  };

  it("starts a run when one may start, and only with a quick, short touch of a finger", () => {
    const { start, tap } = tapping(() => true);
    tap(1);
    expect(start).toHaveBeenCalledTimes(1);
    tap(2, tapMs + 1);
    tap(3, 100, 40);
    finger("pointerdown", 4, 100, 100, { pointerType: "mouse" });
    finger("pointerup", 4, 100, 100, { pointerType: "mouse" });
    finger("pointerdown", 5, 100, 100);
    finger("pointercancel", 5, 100, 100);
    finger("pointerup", 5, 100, 100);
    const bag = stage.querySelector("button");
    if (bag === null) throw new Error("no button");
    finger("pointerdown", 6, 100, 100, { on: bag });
    finger("pointerup", 6, 100, 100, { on: bag });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("does not start the next run with a thumb from the last one, nor while a run may not start", () => {
    let going = true;
    const { start, tap, wait } = tapping(() => !going);
    tap(1);
    expect(start).not.toHaveBeenCalled();
    // A finger down as the run ends, lifted after.
    finger("pointerdown", 2, 100, 100);
    going = false;
    finger("pointerup", 2, 100, 100);
    expect(start).not.toHaveBeenCalled();
    wait(settleMs - 200);
    tap(3);
    expect(start).not.toHaveBeenCalled();
    wait(settleMs);
    tap(4);
    expect(start).toHaveBeenCalledTimes(1);
    // One that came down while a run could start, lifted after one began.
    finger("pointerdown", 5, 100, 100);
    going = true;
    finger("pointerup", 5, 100, 100);
    expect(start).toHaveBeenCalledTimes(1);
  });
});
