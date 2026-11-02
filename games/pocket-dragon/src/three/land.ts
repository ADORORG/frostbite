import {
  Color,
  Euler,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Group,
} from "three";

import { baseRows } from "../rules/woods/base-map.ts";
import { colour } from "../screen/palette.ts";
import { flicker, makePillar, makeTorch, type Torch } from "./machines.ts";
import { group, paint, part, shapes } from "./parts.ts";

// The ground of the woods outside the maze in three dimensions, one unit to a tile (a tile's middle is at its column and row plus a
// half): grass with tufts and flowers, sandy paths, a pond with lily pads, trees of three kinds, the stone walls of DeFu's castle, the
// tiled floor of its hall with pillars, and its dark dungeon lit by braziers. Things that look alike are drawn together, as instances,
// and each tree and flower is placed and sized from its tile, so the woods are the same every time.
export const middle = (x: number, y: number): readonly [number, number] => [
  x + 0.5,
  y + 0.5,
];

// A number from 0 to 1 for a tile, always the same for the same tile.
export function roll(x: number, y: number, salt = 0): number {
  let h =
    Math.imul(x + 1, 374_761_393) ^
    Math.imul(y + 1, 668_265_263) ^
    Math.imul(salt + 1, 1_013_904_223);
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

interface Piece {
  readonly fill: string;
  readonly at: readonly [number, number, number];
  readonly size: readonly [number, number, number];
  readonly spin?: number;
}

const matrix = new Matrix4();
function instances(
  shape: BufferGeometry,
  pieces: readonly Piece[],
  rough = 0.85,
): InstancedMesh {
  const mesh = new InstancedMesh(
    shape,
    paint(colour.white, { rough }),
    Math.max(1, pieces.length),
  );
  mesh.count = pieces.length;
  pieces.forEach((piece, at) => {
    matrix.compose(
      new Vector3(...piece.at),
      new Quaternion().setFromEuler(new Euler(0, piece.spin ?? 0, 0)),
      new Vector3(...piece.size),
    );
    mesh.setMatrixAt(at, matrix);
    mesh.setColorAt(at, new Color(piece.fill));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const floorOf: Readonly<Record<string, readonly [string, string]>> = {
  ",": ["#c9a46a", "#b8935a"],
  G: ["#5d5888", "#4a4670"],
  d: ["#3a3456", "#2c2744"],
};
const hall = new Set(["F", "P", "R", "f", "n", "p", "v"]);
const shade = (
  one: string,
  other: string,
  x: number,
  y: number,
  salt: number,
): string => (roll(x, y, salt) < 0.5 ? one : other);

export interface Land {
  readonly root: Group;
  readonly torches: readonly Torch[];
}

export function buildLand(): Land {
  const floor: Piece[] = [];
  const water: Piece[] = [];
  const walls: Piece[] = [];
  const trunks: Piece[] = [];
  const cones: Piece[] = [];
  const rounds: Piece[] = [];
  const tufts: Piece[] = [];
  const flowers: Piece[] = [];
  const pillars: Group[] = [];
  const torches: Torch[] = [];
  baseRows.forEach((row, y) =>
    [...row].forEach((tile, x) => {
      const [cx, cz] = middle(x, y);
      const r = roll(x, y);
      if (tile === "W" || tile === "t") {
        walls.push({
          at: [cx, 0.65, cz],
          fill: shade(colour.stone, colour.stoneDark, x, y, 1),
          size: [1, 1.3, 1],
        });
        walls.push({
          at: [cx, 1.34, cz],
          fill: "#6a7090",
          size: [1.04, 0.1, 1.04],
        });
        if (tile === "t") {
          const torch = makeTorch();
          torch.root.position.set(cx, 0.4, cz - 0.5);
          torches.push(torch);
        }
        return;
      }
      if (tile === "~") {
        water.push({
          at: [cx, -0.1, cz],
          fill: shade("#2f6fd0", "#3a7fd8", x, y, 2),
          size: [1, 0.1, 1],
        });
        if (r < 0.4)
          flowers.push({
            at: [cx + r - 0.2, -0.03, cz - r / 2],
            fill: colour.leaf,
            size: [0.16, 0.02, 0.16],
          });
        return;
      }
      const [one, other] = hall.has(tile)
        ? ["#6f6a9a", "#5d5888"]
        : (floorOf[tile] ?? ["#58c463", "#4fb85a"]);
      const checker = hall.has(tile)
        ? (x + y) % 2 === 0
          ? one
          : other
        : shade(one, other, x, y, 3);
      floor.push({ at: [cx, -0.05, cz], fill: checker, size: [1, 0.1, 1] });
      if (tile === "p") pillars.push(group([makePillar()], [cx, 0, cz]));
      if (tile === "T") {
        // The trees along the bottom edge, between the camera and the woods, are only bushes.
        const size = (0.75 + roll(x, y, 4) * 0.35) * (y === 27 ? 0.5 : 1);
        const spin = roll(x, y, 5) * Math.PI * 2;
        const leaf = shade("#2f8a4a", "#1f6a38", x, y, 6);
        trunks.push({
          at: [cx, 0.25 * size, cz],
          fill: colour.woodDark,
          size: [0.09 * size, 0.5 * size, 0.09 * size],
          spin,
        });
        if (r < 0.3)
          rounds.push({
            at: [cx, 0.85 * size, cz],
            fill: shade("#3fae5a", "#2f9a48", x, y, 7),
            size: [0.46 * size, 0.42 * size, 0.46 * size],
            spin,
          });
        else {
          cones.push({
            at: [cx, 0.75 * size, cz],
            fill: leaf,
            size: [0.44 * size, 0.7 * size, 0.44 * size],
            spin,
          });
          cones.push({
            at: [cx, 1.15 * size, cz],
            fill: shade("#3fae5a", leaf, x, y, 8),
            size: [0.32 * size, 0.55 * size, 0.32 * size],
            spin,
          });
        }
      } else if (tile === "." && r < 0.55) {
        tufts.push({
          at: [cx + (r - 0.27) * 1.2, 0.08, cz + (roll(x, y, 9) - 0.5) * 0.7],
          fill: colour.leaf,
          size: [0.05, 0.16, 0.05],
          spin: r * 9,
        });
        if (r < 0.22) {
          const petal =
            [colour.pink, colour.gold, colour.lavender, colour.cream][
              Math.floor(roll(x, y, 10) * 4)
            ] ?? colour.pink;
          flowers.push({
            at: [cx - (r - 0.1) * 2, 0.07, cz + r],
            fill: petal,
            size: [0.05, 0.05, 0.05],
          });
        }
      }
    }),
  );
  const pond = instances(shapes.block, water, 0.15);
  pond.receiveShadow = true;
  const root = group([
    instances(shapes.block, floor),
    pond,
    instances(shapes.block, walls),
    instances(shapes.cylinder, trunks),
    instances(shapes.cone, cones),
    instances(shapes.rock, rounds),
    instances(shapes.cone, tufts),
    instances(shapes.ball, flowers),
    ...pillars,
    ...torches.map((torch) => torch.root),
  ]);
  return { root, torches };
}

export function animateLand(land: Land, time: number): void {
  land.torches.forEach((torch, at) => {
    flicker(torch, time, at);
  });
}

// Round the edge of the map, a dark meadow and more trees, so the view never shows the end of the world.
export function outerWoods(): Group {
  const trees: Piece[] = [];
  for (let ring = 1; ring <= 4; ring += 1)
    for (let at = -ring; at < 28 + ring; at += 1)
      for (const [x, y] of [
        [-ring, at],
        [27 + ring, at],
      ] as const) {
        const size = 0.9 + roll(x + 40, y + 40) * 0.6;
        trees.push({
          at: [x + 0.5, 0.8 * size, y + 0.5],
          fill: shade("#1f5a34", "#174a2a", x + 40, y + 40, 1),
          size: [0.5 * size, 1.4 * size, 0.5 * size],
          spin: size * 5,
        });
      }
  const meadow = part(shapes.block, paint("#1d4a2c"), {
    at: [14, -0.2, 14],
    size: [60, 0.2, 60],
  });
  meadow.castShadow = false;
  return group([meadow, instances(shapes.cone, trees)]);
}
