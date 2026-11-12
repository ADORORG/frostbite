import {
  type BufferGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";

import type { Box } from "../../rules/geometry.ts";
import { ways } from "../../rules/layout.ts";
import { taperedTube } from "../body/tube.ts";
import { metres } from "./rooms.ts";
import { archway } from "./shapes.ts";

// The glass of the house: real windows, cut through the outer walls and glazed with clear glass in gold frames, so the rooms are seen
// from the grass and the meadow from the rooms; and the sliding panes of the ways out (the office's tall window, the kitchen's side
// door, the two bedrooms' windows), which slide aside as someone comes near and close behind them.
export const glassPaint = (): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color: "#cfeeff",
    depthWrite: false,
    opacity: 0.16,
    roughness: 0.05,
    side: DoubleSide,
    transparent: true,
  });

type Side = "east" | "front" | "south" | "west";
// Each window, by the wall it is in: where its middle is along the wall and up it, and half its width and height (all ovals).
const windows: readonly (readonly [Side, number, number, number, number])[] = [
  // The kitchen's great scooped window, over the counter; the office's three, smaller toward the door.
  ["front", -7.4, 2.2, 2.9, 1.15],
  ["front", 4, 1.95, 0.5, 0.9],
  ["front", 5.4, 1.95, 0.58, 1],
  ["front", 7, 1.95, 0.66, 1.1],
  // Behind the house: the children's room, the round window at the end of the hall, the parents' room.
  ["south", -7.5, 2, 2.6, 1.15],
  ["south", 0, 2.1, 1.9, 1.2],
  ["south", 10, 2.1, 1.5, 1.1],
  // The children's room, either side of its sliding window; the parents' room, over the bed.
  ["west", 8.1, 2.1, 0.55, 0.95],
  ["west", 12.7, 2.1, 0.55, 0.95],
  ["east", 11.4, 2.1, 1.6, 1.1],
];

const sideOf = (wall: Box): Side | null => {
  const [x, z] = [(wall.x0 + wall.x1) / 2, (wall.z0 + wall.z1) / 2];
  if (wall.x1 - wall.x0 > wall.z1 - wall.z0)
    return z < 500 ? "front" : z > 13_500 ? "south" : null;
  return x < -11_500 ? "west" : x > 11_500 ? "east" : null;
};

// Turns what was drawn on a wall's face (across, up, through) to where the wall stands.
function stand(
  geometry: BufferGeometry,
  wall: Box,
  side: Side,
): BufferGeometry {
  return side === "front" || side === "south"
    ? geometry.translate(0, 0, metres(wall.z0))
    : geometry.rotateY(-Math.PI / 2).translate(metres(wall.x1), 0, 0);
}

// An outer wall with its windows cut through it and glazed; null for a wall with none (which is built plain).
export function glazedWall(
  wall: Box,
  height: number,
  plaster: Material | undefined,
  rib: Material,
): Group | null {
  const side = sideOf(wall);
  if (side === null) return null;
  const flat = side === "front" || side === "south";
  const [from, to] = (flat ? [wall.x0, wall.x1] : [wall.z0, wall.z1]).map(
    metres,
  );
  const own = windows.filter(
    ([where, at]) => where === side && at > (from ?? 0) && at < (to ?? 0),
  );
  if (own.length === 0) return null;
  const face = new Shape();
  face.moveTo(from ?? 0, 0);
  face.lineTo(to ?? 0, 0);
  face.lineTo(to ?? 0, height);
  face.lineTo(from ?? 0, height);
  const group = new Group();
  const glass = glassPaint();
  for (const [, at, up, wide, high] of own) {
    face.holes.push(
      new Path().absellipse(at, up, wide, high, 0, Math.PI * 2, true, 0),
    );
    const pane = new Shape().absellipse(
      at,
      up,
      wide,
      high,
      0,
      Math.PI * 2,
      false,
      0,
    );
    const window = new Mesh(
      stand(new ShapeGeometry(pane, 24).translate(0, 0, 0.1), wall, side),
      glass,
    );
    const round = Array.from({ length: 41 }, (_, step) => {
      const angle = (step / 40) * Math.PI * 2;
      return new Vector3(
        at + Math.cos(angle) * wide,
        up + Math.sin(angle) * high,
        0.1,
      );
    });
    const frame = new Mesh(
      stand(taperedTube(round, { radius: () => 0.075, sides: 6 }), wall, side),
      rib,
    );
    group.add(window, frame);
  }
  const solid = new Mesh(
    stand(
      new ExtrudeGeometry(face, {
        bevelEnabled: false,
        curveSegments: 20,
        depth: 0.2,
      }),
      wall,
      side,
    ),
    plaster,
  );
  solid.castShadow = true;
  solid.receiveShadow = true;
  group.add(solid);
  return group;
}

export interface Sliders {
  readonly group: Group;
  // Where the lead is (metres), to slide the panes aside before them.
  update(x: number, z: number, dt: number): void;
}

// How high each way's arch is: the front door's, the office's tall window, and the rest.
export const wayTop = (index: number): number => [2.9, 3.3][index] ?? 2.75;

// The sliding panes: one curved pane of glass the shape of its archway, in a gold frame, for each way out but the front door.
export function buildSliders(rib: Material): Sliders {
  const group = new Group();
  const glass = glassPaint();
  const panes = ways.slice(1).map((way, index) => {
    const flat = way.x1 - way.x0 > way.z1 - way.z0;
    const [from, to] = (flat ? [way.x0, way.x1] : [way.z0, way.z1]).map(metres);
    const wide = (to ?? 0) - (from ?? 0);
    const outline = archway(-wide / 2, wide / 2, wayTop(index + 1));
    const shape = new Shape();
    outline.forEach(([across, up], at) => {
      if (at === 0) shape.moveTo(across, up);
      else shape.lineTo(across, up);
    });
    const pane = new Group();
    pane.add(
      new Mesh(new ShapeGeometry(shape), glass),
      new Mesh(
        taperedTube(
          outline.map(
            ([across, up]) => new Vector3(across, Math.max(0.04, up), 0),
          ),
          { radius: () => 0.045, sides: 6 },
        ),
        rib,
      ),
    );
    const middle = {
      x: metres(way.x0 + way.x1) / 2,
      z: metres(way.z0 + way.z1) / 2,
    };
    // It rides just outside the wall, and slides along it.
    const out = flat
      ? middle.z < 7
        ? -0.17
        : 0.17
      : middle.x < 0
        ? -0.17
        : 0.17;
    pane.rotation.y = flat ? 0 : Math.PI / 2;
    group.add(pane);
    return { flat, middle, open: 0, out, pane, wide };
  });
  return {
    group,
    update(x, z, dt) {
      for (const one of panes) {
        const near = Math.hypot(x - one.middle.x, z - one.middle.z) < 3.4;
        one.open += ((near ? 1 : 0) - one.open) * (1 - Math.exp(-5 * dt));
        const slid = one.open * one.wide * 0.96;
        one.pane.position.set(
          one.middle.x + (one.flat ? slid : one.out),
          0,
          one.middle.z + (one.flat ? one.out : slid),
        );
      }
    },
  };
}
