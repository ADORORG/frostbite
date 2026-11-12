import { MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";

import { zoneAt } from "../src/rules/geometry.ts";
import { field, shell, ways } from "../src/rules/layout.ts";
import { groundAt } from "../src/view/world/ground.ts";
import { creations } from "../src/rules/create.ts";
import { things } from "../src/rules/things.ts";
import { glassPaint } from "../src/view/world/glass-paint.ts";
import {
  buildGreatWindow,
  great,
  greatOutline,
} from "../src/view/world/house-end.ts";
import {
  buildSliders,
  glazedWall,
  wayTop,
} from "../src/view/world/house-glass.ts";
import { roofAt } from "../src/view/world/roof.ts";
import { createRooms } from "../src/view/world/rooms.ts";
import { crownAt } from "../src/view/world/house-outside.ts";
import { pebble, roundPlan } from "../src/view/world/shapes.ts";
import {
  inside,
  landing,
  stairAt,
  stairLine,
  treadRise,
  treads,
} from "../src/view/world/stair.ts";

describe("the house of curves", () => {
  it("has a roof like a wave: tall over the east wing, low by the door, easing down over each end wall", () => {
    expect(crownAt(11)).toBeGreaterThan(crownAt(0) + 1.5);
    expect(crownAt(-8)).toBeGreaterThan(crownAt(0) + 0.5);
    expect(crownAt(0)).toBeGreaterThan(5);
    expect(crownAt(12.7)).toBeLessThan(crownAt(11));
    expect(crownAt(12.7)).toBeGreaterThan(4);
  });

  it("builds every block as a pebble, rounded whichever way it is thin, and rounds a wall's ends", () => {
    for (const size of [
      [1.2, 0.1, 0.8],
      [0.1, 1.2, 0.8],
      [1.2, 0.8, 0.1],
    ] as const) {
      const made = pebble(size[0], size[1], size[2]);
      made.computeBoundingBox();
      const box = made.boundingBox;
      expect((box?.max.x ?? 0) - (box?.min.x ?? 0)).toBeCloseTo(size[0], 1);
      expect((box?.max.y ?? 0) - (box?.min.y ?? 0)).toBeCloseTo(size[1], 1);
      expect((box?.max.z ?? 0) - (box?.min.z ?? 0)).toBeCloseTo(size[2], 1);
      expect(pebble(size[0], size[1], size[2])).toBe(made);
    }
    const plan = roundPlan(0, 0, 4, 0.2, 0.1);
    expect(plan.every(([x, z]) => x >= 0 && x <= 4 && z >= 0 && z <= 0.2)).toBe(
      true,
    );
    // No point of it is a corner of the rectangle.
    expect(
      plan.some(([x, z]) => (x === 0 || x === 4) && (z === 0 || z === 0.2)),
    ).toBe(false);
  });
});

describe("the ways in and out, and the glass", () => {
  it("opens the outer walls at the tall window, the side door and the bedrooms, onto grass all round the house", () => {
    expect(ways).toHaveLength(5);
    for (const way of ways) {
      const middle = { x: (way.x0 + way.x1) / 2, z: (way.z0 + way.z1) / 2 };
      const inWall = shell.some(
        (wall) =>
          middle.x > wall.x0 &&
          middle.x < wall.x1 &&
          middle.z > wall.z0 &&
          middle.z < wall.z1,
      );
      expect(inWall).toBe(false);
    }
    // Outside the house on every side is the meadow; inside, the rooms as before.
    expect(zoneAt({ x: -14_000, z: 5_000 })).toBe("meadow");
    expect(zoneAt({ x: 14_000, z: 10_000 })).toBe("meadow");
    expect(zoneAt({ x: 0, z: 16_000 })).toBe("meadow");
    expect(zoneAt({ x: 0, z: -3_000 })).toBe("meadow");
    expect(zoneAt({ x: -8_000, z: 10_000 })).toBe("kids");
    expect(zoneAt({ x: 8_000, z: 3_000 })).toBe("office");
    // The field's hedge runs behind the house now.
    expect(Math.max(...field.map((edge) => edge.z1))).toBeGreaterThan(18_000);
  });

  it("raises the ground up the curved stair to the side door, and down one step inside", () => {
    expect(stairAt(0, -5)).toBe(0);
    expect(stairAt(-14, 12)).toBe(0);
    const foot = stairLine(0.02);
    const top = stairLine(0.98);
    expect(stairAt(foot.x, foot.z)).toBeCloseTo(treadRise);
    expect(stairAt(top.x, top.z)).toBeCloseTo(treads * treadRise);
    let last = 0;
    for (let t = 0.02; t < 1; t += 0.05) {
      const at = stairLine(t);
      const high = stairAt(at.x, at.z);
      expect(high).toBeGreaterThanOrEqual(last);
      last = high;
    }
    expect(stairAt(-12.6, 5)).toBe(landing.high);
    expect(stairAt(-11.6, 5)).toBe(inside.high);
    expect(stairAt(-15.9, 2)).toBe(0);
    expect(groundAt(top.x, top.z)).toBeCloseTo(treads * treadRise);
  });

  it("glazes the outer walls that have windows, and slides the panes aside for whoever comes near", () => {
    const rib = new MeshBasicMaterial();
    const front = shell[0];
    const inner = shell[shell.length - 1];
    if (front === undefined || inner === undefined) throw new Error("no walls");
    const glazed = glazedWall(front, 3.5, rib, rib);
    // The kitchen's front wall: its great window's glass and frame, and the wall cut round it.
    expect(glazed?.children).toHaveLength(3);
    expect(glazedWall(inner, 3.5, rib, rib)).toBeNull();
    // A stub of outer wall with no window in it is built plain.
    expect(glazedWall(shell[2] ?? front, 3.5, rib, rib)).toBeNull();
    expect(
      shell.filter((wall) => glazedWall(wall, 3.5, rib, rib) !== null).length,
    ).toBeGreaterThanOrEqual(6);
    expect(glassPaint().transparent).toBe(true);
    expect(glassPaint().opacity).toBeLessThan(0.3);
    const sliders = buildSliders(createRooms(), rib);
    expect(sliders.group.children).toHaveLength(ways.length);
    const [door, tall, side] = sliders.group.children;
    sliders.update(0, 9, 10);
    // Shut: each in its archway, the front door too. It slides aside along the wall for whoever comes near, from either side.
    expect(door?.position.x).toBeCloseTo(0);
    expect(tall?.position.x).toBeCloseTo(9.4);
    sliders.update(0, -2, 10);
    expect(door?.position.x).toBeGreaterThan(1.6);
    sliders.update(0, 2, 10);
    expect(door?.position.x).toBeGreaterThan(1.6);
    sliders.update(9.4, -1, 10);
    expect(tall?.position.x).toBeGreaterThan(11);
    expect(door?.position.x).toBeCloseTo(0);
    expect(side?.position.z).toBeCloseTo(5);
    sliders.update(-13, 5, 10);
    expect(side?.position.z).toBeGreaterThan(6.4);
    expect(tall?.position.x).toBeCloseTo(9.4);
    expect(wayTop(0)).toBeGreaterThan(wayTop(3));
  });

  it("gives the office's end wall one huge arched window under the roof, with the shelves and the easel out of its way", () => {
    const rib = new MeshBasicMaterial();
    const outline = greatOutline();
    const tops = outline.map(([, up]) => up);
    // Taller than the other rooms' walls, and under the roof all the way round.
    expect(Math.max(...tops)).toBeCloseTo(great.top);
    expect(great.top).toBeGreaterThan(5.5);
    for (const [along, up] of outline)
      expect(up).toBeLessThan(roofAt(12, along) - 0.3);
    expect(great.half * 2).toBeGreaterThan(5);
    // The glass, its frame, four mullions, two steps, and the office's walls carried up to the roof.
    expect(buildGreatWindow(createRooms(), rib).children).toHaveLength(10);
    const east = shell.find((wall) => wall.x0 > 11_500);
    if (east === undefined) throw new Error("no east wall");
    // The end wall: the parents' window (glass and frame) and the wall itself, cut for both windows.
    expect(glazedWall(east, 3.5, rib, rib)?.children).toHaveLength(3);
    // Nothing solid stands against the window inside: the shelves are along the office's back wall now.
    const books = things.find((thing) => thing.id === "books");
    expect(books?.z).toBeGreaterThan(6_000);
    expect(books?.x).toBeLessThan(11_000);
    // Zora's easel: out at the meadow's east edge, clear of the house's front and of the way to the tree and the hill.
    const easel = creations.find((made) => made.id === "masterpiece")?.at;
    expect(easel?.x).toBeGreaterThan(12_500);
    expect(zoneAt(easel ?? { x: 0, z: 0 })).toBe("meadow");
  });
});
