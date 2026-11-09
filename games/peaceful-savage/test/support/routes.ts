import { type Point, zoneAt } from "../../src/rules/geometry.ts";

// The ways a bot walks the house: points in open floor and the straight lines between them that no wall crosses. A bot finds the
// point nearest it and the one nearest where it is going (each in the same room), takes the shortest chain of lines between them, and
// walks the last stretch straight.
const nodes = {
  frontIn: { x: 0, z: 800 },
  frontOut: { x: 0, z: -1_500 },
  hallDoorE: { x: 1_800, z: 3_100 },
  hallDoorSE: { x: 1_800, z: 10_300 },
  hallDoorSW: { x: -1_800, z: 10_300 },
  hallDoorW: { x: -1_800, z: 3_100 },
  hallN: { x: 0, z: 1_800 },
  hallS: { x: 0, z: 8_600 },
  kidsDoor: { x: -3_800, z: 10_300 },
  kidsHub: { x: -6_500, z: 10_500 },
  kidsWest: { x: -9_800, z: 10_400 },
  kitDoor: { x: -3_800, z: 3_100 },
  kitHub: { x: -5_200, z: 4_500 },
  kitSouth: { x: -7_700, z: 4_550 },
  kitNorth: { x: -8_000, z: 1_500 },
  kitWest: { x: -9_800, z: 4_800 },
  kitSE: { x: -3_700, z: 6_400 },
  kidsNorth: { x: -6_500, z: 8_300 },
  kidsSouth: { x: -7_500, z: 12_700 },
  kidsNW: { x: -10_600, z: 9_500 },
  offNorth: { x: 6_000, z: 1_300 },
  offNE: { x: 10_400, z: 1_300 },
  offSouth: { x: 8_000, z: 6_200 },
  parWest: { x: 3_700, z: 12_800 },
  mEast: { x: 8_000, z: -6_000 },
  mFarEast: { x: 12_000, z: -10_000 },
  mFarWest: { x: -12_000, z: -8_000 },
  mHill: { x: 0, z: -12_000 },
  mWest: { x: -7_000, z: -6_000 },
  nook: { x: 0, z: 12_000 },
  offDoor: { x: 3_800, z: 3_100 },
  offEast: { x: 10_400, z: 4_300 },
  offHub: { x: 6_000, z: 4_300 },
  parDoor: { x: 3_800, z: 10_300 },
  parHub: { x: 6_800, z: 10_300 },
  parNorth: { x: 9_800, z: 8_600 },
  parSouth: { x: 7_000, z: 12_200 },
  treeE: { x: 1_700, z: 6_000 },
  treeW: { x: -1_800, z: 6_000 },
} as const satisfies Record<string, Point>;

type Node = keyof typeof nodes;

const lines: readonly (readonly [Node, Node])[] = [
  ["hallN", "frontIn"],
  ["frontIn", "frontOut"],
  ["frontOut", "mWest"],
  ["frontOut", "mEast"],
  ["frontOut", "mHill"],
  ["mWest", "mFarWest"],
  ["mEast", "mFarEast"],
  ["mWest", "mHill"],
  ["mEast", "mHill"],
  ["hallN", "hallDoorW"],
  ["hallN", "hallDoorE"],
  ["hallDoorW", "hallDoorE"],
  ["hallDoorW", "treeW"],
  ["hallDoorE", "treeE"],
  ["treeW", "hallS"],
  ["treeE", "hallS"],
  ["hallS", "hallDoorSW"],
  ["hallS", "hallDoorSE"],
  ["hallDoorSW", "hallDoorSE"],
  ["hallDoorSW", "nook"],
  ["hallDoorSE", "nook"],
  ["hallDoorW", "kitDoor"],
  ["kitDoor", "kitHub"],
  ["kitDoor", "kitNorth"],
  ["kitHub", "kitSouth"],
  ["kitSouth", "kitWest"],
  ["kitDoor", "kitSE"],
  ["kidsHub", "kidsNorth"],
  ["kidsHub", "kidsSouth"],
  ["kidsWest", "kidsNW"],
  ["offDoor", "offNorth"],
  ["offNorth", "offNE"],
  ["offEast", "offNE"],
  ["offHub", "offSouth"],
  ["parDoor", "parWest"],
  ["parSouth", "parWest"],
  ["kitHub", "kitNorth"],
  ["hallDoorSW", "kidsDoor"],
  ["kidsDoor", "kidsHub"],
  ["kidsHub", "kidsWest"],
  ["hallDoorE", "offDoor"],
  ["offDoor", "offHub"],
  ["offHub", "offEast"],
  ["hallDoorSE", "parDoor"],
  ["parDoor", "parHub"],
  ["parHub", "parNorth"],
  ["parHub", "parSouth"],
];

const names = Object.keys(nodes).filter((name): name is Node => name in nodes);
const far = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

// The way point nearest a place, in the same room (the front step counts as the meadow's, the hall's end as the hall's).
function nearestNode(at: Point): Node {
  const zone = zoneAt(at);
  const same = names.filter((name) => zoneAt(nodes[name]) === zone);
  const pool = same.length > 0 ? same : names;
  return pool.reduce((best, name) =>
    far(nodes[name], at) < far(nodes[best], at) ? name : best,
  );
}

// The points to walk through from one place to another, ending at the second place.
export function route(from: Point, to: Point): readonly Point[] {
  const start = nearestNode(from);
  const goal = nearestNode(to);
  const cost = new Map<Node, number>([[start, 0]]);
  const back = new Map<Node, Node>();
  const open: Node[] = [start];
  while (open.length > 0) {
    open.sort((a, b) => (cost.get(a) ?? 0) - (cost.get(b) ?? 0));
    const here = open.shift();
    if (here === undefined || here === goal) break;
    for (const [a, b] of lines) {
      const next = a === here ? b : b === here ? a : null;
      if (next === null) continue;
      const through = (cost.get(here) ?? 0) + far(nodes[here], nodes[next]);
      if (through < (cost.get(next) ?? Number.POSITIVE_INFINITY)) {
        cost.set(next, through);
        back.set(next, here);
        open.push(next);
      }
    }
  }
  const chain: Point[] = [];
  for (let at: Node | undefined = goal; at !== undefined; at = back.get(at))
    chain.unshift(nodes[at]);
  return [...chain, to];
}
