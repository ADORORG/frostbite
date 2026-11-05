import { describe, expect, it } from "vitest";

import {
  controlProblems,
  maximumTargets,
  minimumTarget,
  type Controls,
} from "../src/game-controls.ts";
import type { Box } from "../src/game-layout.ts";

const frame = { height: 400, width: 800 };
const box = (
  name: string,
  x: number,
  y: number,
  size = minimumTarget,
): Box => ({
  h: size,
  name,
  w: size,
  x,
  y,
});
const good: Controls = {
  spoken: [],
  hud: { h: 20, name: "hud", w: 300, x: 60, y: 4 },
  targets: [box("music", 600, 4), box("effects", 650, 4), box("pause", 700, 4)],
};

describe("what a thumb can use on a game page", () => {
  it("accepts a few well-spaced icons that clear the readouts", () => {
    expect(controlProblems(good, frame)).toEqual([]);
  });

  it("accepts a page with nothing to press and no readouts", () => {
    expect(
      controlProblems({ hud: null, spoken: [], targets: [] }, frame),
    ).toEqual([]);
  });

  it("refuses an icon that a screen reader would read out as text", () => {
    expect(controlProblems({ ...good, spoken: ["pause"] }, frame)).toEqual([
      "pause's icon would be read out as text",
    ]);
  });

  it("refuses more than the few that are allowed", () => {
    const many = Array.from({ length: maximumTargets + 1 }, (_, index) =>
      box(`b${String(index)}`, index * 100, 100),
    );
    expect(
      controlProblems({ hud: null, spoken: [], targets: many }, frame),
    ).toEqual([expect.stringContaining(`at most ${String(maximumTargets)}`)]);
  });

  it("refuses a target under the size, on either side, and accepts one at it", () => {
    const wide: Box = {
      h: minimumTarget - 1,
      name: "slim",
      w: 100,
      x: 0,
      y: 0,
    };
    const tall: Box = {
      h: 100,
      name: "narrow",
      w: minimumTarget - 1,
      x: 200,
      y: 0,
    };
    expect(
      controlProblems({ hud: null, spoken: [], targets: [wide] }, frame),
    ).toEqual([
      `slim is 100x${String(minimumTarget - 1)}, under ${String(minimumTarget)}`,
    ]);
    expect(
      controlProblems({ hud: null, spoken: [], targets: [tall] }, frame),
    ).toEqual([
      `narrow is ${String(minimumTarget - 1)}x100, under ${String(minimumTarget)}`,
    ]);
    expect(
      controlProblems(
        { hud: null, spoken: [], targets: [box("exact", 0, 0)] },
        frame,
      ),
    ).toEqual([]);
  });

  it("refuses a target past any edge of the frame, and accepts one that touches it", () => {
    for (const name of ["left", "top", "right", "bottom"]) {
      const at = {
        bottom: box(name, 100, frame.height - minimumTarget + 1),
        left: box(name, -1, 100),
        right: box(name, frame.width - minimumTarget + 1, 100),
        top: box(name, 100, -1),
      }[name] as Box;
      expect(
        controlProblems({ hud: null, spoken: [], targets: [at] }, frame),
      ).toEqual([`${name} is outside the frame`]);
    }
    expect(
      controlProblems(
        {
          hud: null,
          spoken: [],
          targets: [
            box(
              "corner",
              frame.width - minimumTarget,
              frame.height - minimumTarget,
            ),
          ],
        },
        frame,
      ),
    ).toEqual([]);
  });

  it("refuses two targets that overlap, and accepts two that only touch", () => {
    expect(
      controlProblems(
        {
          hud: null,
          spoken: [],
          targets: [box("a", 0, 0), box("b", minimumTarget - 1, 0)],
        },
        frame,
      ),
    ).toEqual(["a overlaps b"]);
    expect(
      controlProblems(
        {
          hud: null,
          spoken: [],
          targets: [box("a", 0, 0), box("b", minimumTarget, 0)],
        },
        frame,
      ),
    ).toEqual([]);
    expect(
      controlProblems(
        {
          hud: null,
          spoken: [],
          targets: [box("a", 0, 0), box("b", 0, minimumTarget - 1)],
        },
        frame,
      ),
    ).toEqual(["a overlaps b"]);
  });

  it("refuses a target on the readouts, and accepts one beside them", () => {
    const hud: Box = { h: 20, name: "hud", w: 100, x: 100, y: 0 };
    expect(
      controlProblems(
        { hud, spoken: [], targets: [box("on", 150, 10)] },
        frame,
      ),
    ).toEqual(["on overlaps the readouts"]);
    expect(
      controlProblems(
        { hud, spoken: [], targets: [box("beside", 200, 0)] },
        frame,
      ),
    ).toEqual([]);
  });
});
