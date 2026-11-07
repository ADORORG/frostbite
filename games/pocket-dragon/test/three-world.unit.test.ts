import { InstancedMesh, Mesh, Scene } from "three";
import { describe, expect, it } from "vitest";

import { baseRows, chests, panels } from "../src/rules/woods/base-map.ts";
import { sceneTicks } from "../src/rules/woods/scenes.ts";
import type { WoodsState } from "../src/rules/woods/types.ts";
import { rocketFoot, rocketLift, shotOf } from "../src/three/camera.ts";
import { facingAngle, makeCast, showCast } from "../src/three/cast.ts";
import { buildLand, outerWoods, roll } from "../src/three/land.ts";
import { ease, toward, turnToward } from "../src/three/parts.ts";
import { buildWorld, makeThings, showThings } from "../src/three/world.ts";
import { baseOf, inLair, outside } from "./support/woods-outside.ts";

const tiles = (wanted: string): number =>
  baseRows
    .join("")
    .split("")
    .filter((tile) => tile === wanted).length;
const settle = 10;

describe("the woods in three dimensions", () => {
  it("are built once from the map: the ground, the trees and the walls drawn as instances, the same every time", () => {
    const land = buildLand();
    const counts = land.root.children
      .filter((child): child is InstancedMesh => child instanceof InstancedMesh)
      .map((mesh) => mesh.count);
    const [floor, pond, walls, trunks] = counts;
    expect(trunks).toBe(tiles("T"));
    expect(walls).toBe(2 * (tiles("W") + tiles("t")));
    expect((floor ?? 0) + (pond ?? 0) + tiles("W") + tiles("t")).toBe(28 * 28);
    expect(pond).toBe(tiles("~"));
    expect(land.torches).toHaveLength(tiles("t"));
    expect(roll(3, 4)).toBe(roll(3, 4));
    expect(roll(3, 4)).not.toBe(roll(4, 3));
    expect(
      Math.max(...[0, 1, 2, 3].map((salt) => roll(5, 6, salt))),
    ).toBeLessThan(1);
    expect(outerWoods().children.length).toBe(2);
  });

  it("put Glitchy where the rules have it, turned the way it faces, blinking after a bump, breathing fire and inside its forcefield", () => {
    const cast = makeCast(4);
    const facing = outside({ facing: "left" });
    showCast(cast, facing, baseOf(facing), 1, settle);
    const { root } = cast.glitchy;
    expect([root.position.x, root.position.z]).toEqual([12.5, 26.5]);
    expect(root.rotation.y).toBeCloseTo(facingAngle.left);
    expect(root.visible).toBe(true);
    expect(cast.breath.visible).toBe(false);
    expect(cast.forcefield.visible).toBe(false);
    const busy = outside(
      { fireTick: 97, forcefield: 50, invulnerable: 30 },
      { tick: 100 },
    );
    showCast(cast, busy, baseOf(busy), 2, settle);
    expect(cast.breath.visible).toBe(true);
    expect(cast.forcefield.visible).toBe(true);
    expect(root.visible).toBe(true);
    showCast(cast, { ...busy, tick: 98 }, baseOf(busy), 2, settle);
    expect(root.visible).toBe(false);
  });

  it("bring the freed dragons along behind Glitchy, the guards on their routes (gone once cheered up) and shadow dragons from the factory", () => {
    const cast = makeCast(4);
    const freed = outside({
      allies: [true, false, false],
      trail: [{ x: 12, y: 27 }],
    });
    showCast(cast, freed, baseOf(freed), 1, settle);
    const [first, second] = cast.followers;
    expect(first?.root.visible).toBe(true);
    expect(second?.root.visible).toBe(false);
    expect(first?.root.position.z).toBeCloseTo(27.5);
    const guards = baseOf(freed).guards.filter((guard) => guard.route !== 1);
    showCast(cast, freed, { ...baseOf(freed), guards }, 1, settle);
    expect(cast.guards.map((guard) => guard.root.visible)).toEqual([
      true,
      false,
      true,
      true,
    ]);
    const shadows = inLair({
      shadows: [
        { moved: 0, x: 5, y: 7 },
        { moved: 0, x: 9, y: 3 },
      ],
    });
    showCast(cast, shadows, baseOf(shadows), 1, settle);
    const seen = cast.shadows.filter((shadow) => shadow.root.visible);
    expect(seen).toHaveLength(2);
    expect(
      seen.map(({ root }) => Math.round(root.position.x * 2) / 2).sort(),
    ).toEqual([5.5, 9.5]);
    showCast(cast, shadows, { ...baseOf(shadows), shadows: [] }, 1, settle);
    expect(cast.shadows.some((shadow) => shadow.root.visible)).toBe(false);
  });

  it("open chests and cages, stop and darken broken valves, light fitted panels, lift the gate and drop the rocket's shield with the factory", () => {
    const things = makeThings(new Scene());
    const start = inLair();
    showThings(things, start, baseOf(start), 1, settle);
    expect(things.chests.map((chest) => chest.key.visible)).toEqual([
      false,
      false,
      false,
    ]);
    expect(things.rocket.shield.visible).toBe(true);
    expect(things.gate.visible).toBe(true);
    expect(things.bubble.visible).toBe(true);
    const done = inLair({
      allies: [true, true, true],
      broken: [true, true, true],
      bubbleTaken: true,
      heartTaken: true,
      installed: [true, false, false],
      pieces: [true, true, true],
    });
    for (let frame = 0; frame < 5; frame += 1)
      showThings(things, done, baseOf(done), frame, settle);
    expect(
      things.chests.every(
        (chest) => chest.key.visible && chest.lid.rotation.x < -1.8,
      ),
    ).toBe(true);
    expect(
      things.cages.every(
        (cage) => !cage.dragon.root.visible && !cage.bars.visible,
      ),
    ).toBe(true);
    expect(things.valves[0]?.metal.emissiveIntensity).toBe(0);
    expect(things.panels.map((panel) => panel.light.emissiveIntensity)).toEqual(
      [1.5, expect.any(Number), expect.any(Number)],
    );
    expect(things.rocket.shield.visible).toBe(false);
    expect(things.gate.visible).toBe(false);
    expect([things.bubble.visible, things.heart.visible]).toEqual([
      false,
      false,
    ]);
    const flying = outside({
      flight: { dx: 1, dy: 0, left: 4, moved: 0, x: 14, y: 26 },
    });
    showThings(things, flying, baseOf(flying), 1, settle);
    expect(things.egg.visible).toBe(true);
    expect(things.egg.position.x).toBeCloseTo(14.5);
    const launch = inLair(
      {},
      { scene: { id: "launch", start: 0 }, tick: sceneTicks.launch / 2 },
    );
    showThings(things, launch, baseOf(launch), 1, settle);
    expect(things.rocket.root.position.y).toBeCloseTo(rocketLift(0.5));
    expect(things.rocket.flame.visible).toBe(true);
    expect(things.rocket.shield.visible).toBe(false);
    expect(chests).toHaveLength(things.chests.length);
    expect(panels).toHaveLength(things.panels.length);
  });

  it("are seen from above and behind Glitchy (farther back in the lair), and in each scene from the camera's own path", () => {
    const at = [12.5, 0, 26.5] as const;
    const woods = outside();
    const play = shotOf(woods, baseOf(woods), at);
    expect(play.glide).toBe(true);
    expect(play.from[1]).toBeGreaterThan(5);
    expect(play.from[2]).toBeGreaterThan(at[2]);
    const lair = inLair();
    expect(shotOf(lair, baseOf(lair), at).from[1]).toBeGreaterThan(
      play.from[1],
    );
    const scene = (
      id: "launch" | "lair" | "peace" | "rise",
      share: number,
      state: WoodsState = woods,
    ) =>
      shotOf(
        {
          ...state,
          scene: { id, start: 0 },
          tick: Math.round(share * sceneTicks[id]),
        },
        baseOf(state),
        at,
      );
    expect(scene("rise", 0).from[1]).toBeLessThan(1);
    const near = (one: readonly number[], other: readonly number[]) =>
      one.every((value, at) => Math.abs(value - (other[at] ?? NaN)) < 1e-9);
    expect(near(scene("rise", 1).from, play.from)).toBe(true);
    expect(scene("rise", 0.5).glide).toBe(false);
    expect(scene("lair", 0.5).look[2]).toBeCloseTo(2.5);
    expect(near(scene("lair", 1).look, play.look)).toBe(true);
    expect(scene("peace", 0.5).look).toEqual([
      rocketFoot[0],
      1.5,
      rocketFoot[2],
    ]);
    expect(scene("launch", 1).look[1]).toBeGreaterThan(
      scene("launch", 0.2).look[1],
    );
  });

  it("show the whole scene for a state, moving the moonlight with the camera and lighting DeFu's lair when Glitchy is inside", () => {
    const world = buildWorld();
    const meshes: Mesh[] = [];
    world.scene.traverse((part) => {
      if (part instanceof Mesh) meshes.push(part);
    });
    expect(meshes.length).toBeGreaterThan(300);
    const woods = outside();
    const shot = world.show(woods, baseOf(woods), 1, 1);
    expect(shot.glide).toBe(true);
    const lair = inLair(
      { x: 13, y: 8 },
      { scene: { id: "peace", start: 0 }, tick: 100 },
    );
    for (let frame = 0; frame < 20; frame += 1)
      world.show(lair, baseOf(lair), frame, 0.5);
    const launched = inLair(
      {},
      { scene: { id: "launch", start: 0 }, tick: 100 },
    );
    expect(world.show(launched, baseOf(launched), 3, 0.1).glide).toBe(false);
  });

  it("ease and glide smoothly, and turn the short way round", () => {
    expect([ease(-1), ease(0.5), ease(2)]).toEqual([0, 0.5, 1]);
    expect(toward(0, 10, 100)).toBeCloseTo(10);
    expect(toward(0, 10, 0)).toBe(0);
    expect(turnToward(3, -3, 100)).toBeCloseTo(-3 + 2 * Math.PI);
  });
});
