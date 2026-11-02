import { Color, Fog, Scene } from "three";
import { describe, expect, it } from "vitest";

import { shotOf } from "../src/three/camera.ts";
import { flightHeights, makeFrost, showFrost } from "../src/three/frost.ts";
import { buildWorld } from "../src/three/world.ts";
import { colour } from "../src/screen/palette.ts";
import { baseOf, outside, press } from "./support/woods-outside.ts";

const seeing = () =>
  press(
    outside(
      { facing: "up", x: 10, y: 26 },
      { plasma: { ...outside().plasma, gathered: 20 } },
    ),
    "vision",
  );

describe("flying and frost vision in three dimensions", () => {
  it("lays each future as stepping stones with a gem at its end, frosts the night, and shadows Glitchy in the air", () => {
    const scene = new Scene();
    scene.background = new Color("#1a0e3d");
    scene.fog = new Fog("#1a0e3d", 13, 30);
    const frost = makeFrost(scene);
    expect(frost.trails).toHaveLength(3);
    expect(frost.trails.every((trail) => !trail.end.visible)).toBe(true);
    const state = seeing();
    showFrost(frost, scene, state, baseOf(state), [10.5, 0.9, 26.5], 0.5);
    const [ahead] = frost.trails;
    expect(ahead?.marks.filter((mark) => mark.visible)).toHaveLength(2);
    expect(ahead?.end.visible).toBe(true);
    expect(`#${ahead?.paint.color.getHexString() ?? ""}`).toBe(colour.gold);
    expect(frost.shadow.visible).toBe(true);
    expect(
      scene.background instanceof Color && scene.background.b,
    ).toBeGreaterThan(new Color("#1a0e3d").b);
    const calm = outside();
    showFrost(frost, scene, calm, baseOf(calm), [12.5, 0, 26.5], 0.5);
    expect(frost.trails.every((trail) => !trail.end.visible)).toBe(true);
    expect(frost.shadow.visible).toBe(false);
  });

  it("pulls the camera up and back while Glitchy soars, and lifts Glitchy to its height", () => {
    const ground = outside();
    const high = outside({ altitude: 2 });
    const low = shotOf(ground, baseOf(ground), [12.5, 0, 26.5]);
    const soaring = shotOf(high, baseOf(high), [12.5, flightHeights[2], 26.5]);
    expect(soaring.from[1] - soaring.look[1]).toBeGreaterThan(
      low.from[1] - low.look[1],
    );
    const world = buildWorld();
    let shot = world.show(high, baseOf(high), 0, 0.016);
    for (let frame = 1; frame < 90; frame += 1)
      shot = world.show(high, baseOf(high), frame / 60, 1 / 60);
    expect(shot.look[1]).toBeGreaterThan(2);
  });
});
