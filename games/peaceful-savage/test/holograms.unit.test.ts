import { type Mesh, type Sprite, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  beatLead,
  breathInTicks,
  breathOutTicks,
  ticksPerSecond,
} from "../src/rules/constants.ts";
import type { MomentKind } from "../src/rules/moments.ts";
import type { Moment, PlayState } from "../src/rules/types.ts";
import { drawingOf } from "../src/view/acting.ts";
import { leapAt, leapSeconds } from "../src/view/body/leap.ts";
import { alongRoute } from "../src/view/compass.ts";
import { createNudge, stallTicks } from "../src/view/nudge.ts";
import { buildHolograms } from "../src/view/world/holograms.ts";
import { type Sigil, strokesOf } from "../src/view/world/sigils.ts";
import { led } from "./support/states.ts";

const momentOf = (kind: MomentKind, over: Partial<Moment> = {}): Moment => ({
  arg: 0,
  exhaleUntil: -1,
  holding: -1,
  kind,
  since: 0,
  skill: -1,
  step: 0,
  target: -1,
  ...over,
});

const sigils: readonly Sigil[] = [
  "comb",
  "cup",
  "field",
  "flower",
  "knock",
  "knot",
  "letgo",
  "shield",
  "split",
  "star",
];

describe("the shapes of light the lead draws", () => {
  it("are read from the state: a hand-key as it rises to its beat, the breath's shield and field, the centring's flower, a dance's star", () => {
    const tick = 600;
    const at = (over: Partial<PlayState>) => drawingOf(led({ tick, ...over }));
    expect(at({})).toBeNull();
    // A practice of the Cup, half way to its beat.
    expect(
      at({
        moment: momentOf("practice", { skill: 0, target: tick + beatLead / 2 }),
      }),
    ).toEqual({ drawn: 0.5, sigil: "cup" });
    // A breath held for a while, then let go.
    const breath = (over: Partial<Moment>) =>
      at({ moment: momentOf("practice", { skill: 6, ...over }) });
    expect(breath({})).toBeNull();
    expect(breath({ holding: tick - 60 })).toEqual({
      drawn: 60 / breathInTicks,
      sigil: "shield",
    });
    expect(breath({ exhaleUntil: tick + 90 })).toEqual({
      drawn: 1 - 90 / breathOutTicks,
      sigil: "field",
    });
    // At a mirror, coming back to centre.
    expect(
      at({ moment: momentOf("mirror", { since: tick - 30, step: 1 }) }),
    ).toEqual({ drawn: 30 / (ticksPerSecond * 2), sigil: "flower" });
    // A choice draws nothing.
    expect(at({ moment: momentOf("grey") })).toBeNull();
    // A skill mastered: the dance, and its star.
    const news = { detail: "", kind: "mastered", tick: tick - 18 } as const;
    expect(at({ news })).toEqual({
      drawn: 18 / (ticksPerSecond * 1.2),
      sigil: "star",
    });
    expect(at({ news: { ...news, kind: "thing" } })).toBeNull();
  });

  it("are each strokes of at least two points, every point a real place", () => {
    for (const sigil of sigils) {
      const strokes = strokesOf(sigil);
      expect(strokes.length).toBeGreaterThan(0);
      for (const stroke of strokes) {
        expect(stroke.length).toBeGreaterThan(1);
        for (const point of stroke)
          expect(Number.isFinite(point.x + point.y + point.z)).toBe(true);
      }
    }
  });

  it("are drawn line by line with a pen of light at the drawing end, then fade once the move is done", () => {
    const holograms = buildHolograms();
    const bearer = {
      at: new Vector3(1, 0, 2),
      hands: [new Vector3(0.8, 1.1, 2.3), new Vector3(1.2, 1.1, 2.3)],
      height: 1.4,
      yaw: 0.5,
    };
    const meshes = () =>
      holograms.group.children.filter(
        (child): child is Mesh => "isMesh" in child,
      );
    const pen = holograms.group.children.find(
      (child): child is Sprite => "isSprite" in child,
    );
    for (const [index, sigil] of sigils.entries()) {
      for (let frame = 0; frame < 20; frame += 1)
        holograms.update({ drawn: 0.5, sigil }, bearer, index + frame, 0.05);
      const shape = meshes()[index];
      const drawn = shape?.geometry.drawRange.count ?? 0;
      expect(shape?.visible).toBe(true);
      expect(drawn).toBeGreaterThan(0);
      expect(drawn).toBeLessThan(shape?.geometry.getIndex()?.count ?? 0);
      expect(pen?.visible).toBe(true);
    }
    // Drawn in full, the pen is put down; with no move under way every shape fades away.
    holograms.update({ drawn: 1, sigil: "star" }, bearer, 30, 2);
    expect(pen?.visible).toBe(false);
    for (let frame = 0; frame < 40; frame += 1)
      holograms.update(null, null, 31 + frame, 0.1);
    expect(meshes().every((shape) => !shape.visible)).toBe(true);
    // A move with nobody to draw it draws nothing.
    holograms.update({ drawn: 0.5, sigil: "cup" }, null, 80, 0.1);
    expect(meshes().every((shape) => !shape.visible)).toBe(true);
    // Without hands, a hand-key is drawn before the chest.
    holograms.update(
      { drawn: 0.5, sigil: "knot" },
      { ...bearer, hands: [] },
      81,
      0.5,
    );
    expect(meshes().some((shape) => shape.visible)).toBe(true);
  });
});

describe("Sparky's tug when the story stalls", () => {
  it("tugs only after a long while with no story and no moment, far from where the story goes next, and stops as it moves", () => {
    const nudge = createNudge();
    const far = led({ sparky: true, tick: 100, x: 0, z: -20_000 });
    expect(nudge.update(far)).toBe(false);
    expect(nudge.update({ ...far, tick: 100 + stallTicks - 1 })).toBe(false);
    expect(nudge.update({ ...far, tick: 100 + stallTicks })).toBe(true);
    // At the tree (where the story goes next for a lead who has not touched it), there is nowhere to tug to.
    expect(
      nudge.update({ ...far, tick: 100 + stallTicks, x: 0, z: 6_000 }),
    ).toBe(false);
    // Something found: the story moved, so the wait starts again.
    const moved = {
      ...far,
      news: { detail: "", kind: "found", tick: 200 + stallTicks },
      tick: 200 + stallTicks,
    } as const;
    expect(nudge.update(moved)).toBe(false);
    expect(nudge.update({ ...moved, tick: 200 + stallTicks * 2 })).toBe(true);
    // A moment under way, or no Sparky yet, is never a stall; nor is a new run.
    expect(
      nudge.update({
        ...moved,
        moment: momentOf("grey"),
        tick: 300 + stallTicks * 3,
      }),
    ).toBe(false);
    expect(
      nudge.update({ ...moved, sparky: false, tick: 400 + stallTicks * 4 }),
    ).toBe(false);
    expect(nudge.update({ ...far, tick: 5 })).toBe(false);
  });

  it("flies a distance along the gold thread, or to its end", () => {
    const route = [
      new Vector3(0, 0, 0),
      new Vector3(0, 0, 0),
      new Vector3(3, 0, 0),
      new Vector3(3, 0, 4),
    ];
    expect(alongRoute(route, 1)).toEqual(new Vector3(1, 0, 0));
    expect(alongRoute(route, 5)).toEqual(new Vector3(3, 0, 2));
    expect(alongRoute(route, 100)).toEqual(new Vector3(3, 0, 4));
    expect(alongRoute([], 2)).toEqual(new Vector3());
  });
});

describe("a jump, which is only seen", () => {
  it("crouches, flies like a thrown ball (higher at a run) and lands, then is over", () => {
    expect(leapSeconds(0)).toBeCloseTo(0.66);
    expect(leapSeconds(1)).toBeCloseTo(0.76);
    expect(leapAt(-0.1, 0.8, 0)).toBeNull();
    expect(leapAt(leapSeconds(0), 0.8, 0)).toBeNull();
    expect(leapAt(0.05, 0.8, 0)?.lift).toBe(0);
    expect(leapAt(0.1 + 0.21, 0.8, 0)?.lift).toBeCloseTo(0.4);
    const running = leapAt(0.1 + 0.26, 0.8, 1)?.lift ?? 0;
    expect(running).toBeGreaterThan(0.4);
    const landing = leapAt(0.1 + 0.42 + 0.07, 0.8, 0);
    expect(landing?.lift).toBe(0);
    expect(landing?.pose["hips.drop"]).toBeLessThan(0);
  });
});
