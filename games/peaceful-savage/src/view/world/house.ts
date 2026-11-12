import {
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  Shape,
  TorusGeometry,
  Vector3,
} from "three";

import type { ZoneId } from "../../rules/constants.ts";
import { zoneAt } from "../../rules/geometry.ts";
import { walls } from "../../rules/layout.ts";
import { taperedTube } from "../body/tube.ts";
import {
  brushed,
  glowing,
  painted,
  planks,
  starMap,
  tiles,
} from "../palette.ts";
import { buildOutside } from "./house-outside.ts";
import { metres, type Rooms } from "./rooms.ts";
import { archway, prism, roundPlan } from "./shapes.ts";

// The Savage house, a home of the future with no right angle in it: the rules' walls stood up three and a half metres in warm plaster,
// every end of a wall rolled round; the corners of every room swept into a curve; a soft vault over every room and a barrel vault
// over the hall, with gold ribs; a tall oval arch over every doorway. Outside (house-outside.ts): the long wave of the roof in purple
// scales, its cream lip, the glowing windows and the round-topped front door. Only the walls and furniture of the plan block a body; the curves
// here take a hand's breadth off a corner at most.
export const wallHeight = 3.5;

const floors: readonly {
  readonly colour: string;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly zone: ZoneId;
}[] = [
  { colour: "#a5713f", x0: -3, x1: 3, z0: 0, z1: 14, zone: "hall" },
  { colour: "#2f8c85", x0: -12, x1: -3, z0: 0, z1: 7, zone: "kitchen" },
  { colour: "#6a4f9e", x0: -12, x1: -3, z0: 7, z1: 14, zone: "kids" },
  { colour: "#5c3b22", x0: 3, x1: 12, z0: 0, z1: 7, zone: "office" },
  { colour: "#9a4f63", x0: 3, x1: 12, z0: 7, z1: 14, zone: "parents" },
];

// The doorways: the four from the hall (in walls running north to south) and the front door (in the wall running east to west).
const doorways: readonly {
  readonly along: "x" | "z";
  readonly at: number;
  readonly from: number;
  readonly to: number;
  readonly top: number;
}[] = [
  { along: "z", at: -3, from: 2.4, to: 3.8, top: 2.75 },
  { along: "z", at: -3, from: 9.6, to: 11, top: 2.75 },
  { along: "z", at: 3, from: 2.4, to: 3.8, top: 2.75 },
  { along: "z", at: 3, from: 9.6, to: 11, top: 2.75 },
  { along: "x", at: 0, from: -0.9, to: 0.9, top: 2.9 },
];

// How far a room's corner is swept round, and how high its vault rises in the middle.
const sweep = 0.75;
const rise = 0.8;

export interface House {
  readonly group: Group;
}

export function buildHouse(rooms: Rooms): House {
  const group = new Group();
  group.name = "house";
  const plaster = Object.fromEntries(
    (["hall", "kitchen", "kids", "office", "parents", "meadow"] as const).map(
      (zone, index) => [
        zone,
        painted(rooms.tones[zone], {
          color: "#efe2c8",
          map: brushed("#f1e4cb", 40 + index, 1, 0.4),
          side: DoubleSide,
        }),
      ],
    ),
  );
  const line = glowing("#e7b04a", 0.9);
  floors.forEach((floor, index) => {
    const wide = floor.x1 - floor.x0;
    const deep = floor.z1 - floor.z0;
    const middle = [(floor.x0 + floor.x1) / 2, (floor.z0 + floor.z1) / 2];
    const mesh = new Mesh(
      new PlaneGeometry(wide, deep),
      painted(rooms.tones[floor.zone], {
        color: "#ffffff",
        map:
          floor.zone === "kitchen"
            ? tiles(floor.colour, 9 + index)
            : floor.zone === "kids"
              ? brushed(floor.colour, 9 + index, 4)
              : planks(floor.colour, 9 + index),
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(middle[0] ?? 0, 0.001, middle[1] ?? 0);
    mesh.receiveShadow = true;
    group.add(mesh);
    // Each corner of the room swept round, floor to ceiling.
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const cx = (sx > 0 ? floor.x1 : floor.x0) - sx * 0.09;
      const cz = (sz > 0 ? floor.z1 : floor.z0) - sz * 0.09;
      const outline: [number, number][] = [
        [cx, cz],
        ...Array.from({ length: 9 }, (_, step): [number, number] => {
          const angle = (step / 8) * (Math.PI / 2);
          return [
            cx - sx * sweep * (1 - Math.sin(angle)),
            cz - sz * sweep * (1 - Math.cos(angle)),
          ];
        }),
      ];
      const corner = new Mesh(prism(outline, wallHeight), plaster[floor.zone]);
      corner.receiveShadow = true;
      group.add(corner);
    }
    if (floor.zone === "hall") return;
    // The room's vault: a soft dome that meets every wall, highest in the middle.
    const vault = new PlaneGeometry(wide, deep, 20, 20);
    const position = vault.getAttribute("position");
    for (let at = 0; at < position.count; at += 1) {
      const u = Math.cos((position.getX(at) / wide) * Math.PI);
      const v = Math.cos((position.getY(at) / deep) * Math.PI);
      position.setZ(at, -rise * Math.max(0, u) ** 0.7 * Math.max(0, v) ** 0.7);
    }
    vault.computeVertexNormals();
    const ceiling = new Mesh(vault, plaster[floor.zone]);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(middle[0] ?? 0, wallHeight, middle[1] ?? 0);
    group.add(ceiling);
  });
  // The walls of the house (not the meadow's hedges, which the meadow draws), each end rolled round, and a line of gold round each at
  // the top and at hand height: the house's own line-work.
  for (const wall of walls.slice(0, 13)) {
    const [x0, z0, x1, z1] = [wall.x0, wall.z0, wall.x1, wall.z1].map(metres);
    const zone = zoneAt({
      x: (wall.x0 + wall.x1) / 2,
      z: Math.max(1, (wall.z0 + wall.z1) / 2),
    });
    const outline = roundPlan(x0 ?? 0, z0 ?? 0, x1 ?? 0, z1 ?? 0, 0.1);
    const mesh = new Mesh(prism(outline, wallHeight), plaster[zone]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const band = roundPlan(
      (x0 ?? 0) - 0.015,
      (z0 ?? 0) - 0.015,
      (x1 ?? 0) + 0.015,
      (z1 ?? 0) + 0.015,
      0.115,
    );
    for (const height of [wallHeight - 0.18, 1.0]) {
      const strip = new Mesh(prism(band, 0.035), line);
      strip.position.y = height;
      group.add(strip);
    }
  }
  // Over every doorway, the wall comes down in a tall oval arch, edged in gold on both faces.
  const rib = glowing("#e7b04a", 0.6);
  for (const door of doorways) {
    const opening = archway(door.from, door.to, door.top);
    const shape = new Shape();
    shape.moveTo(door.from - 0.06, 0);
    for (const [across, up] of opening) shape.lineTo(across, up);
    shape.lineTo(door.to + 0.06, 0);
    shape.lineTo(door.to + 0.06, wallHeight);
    shape.lineTo(door.from - 0.06, wallHeight);
    const geometry = new ExtrudeGeometry(shape, {
      bevelEnabled: false,
      depth: 0.2,
    }).translate(0, 0, -0.1);
    const lintel = new Mesh(geometry, plaster.hall);
    const edge = opening.map(([across, up]) => new Vector3(across, up, 0));
    const trims = [0.11, -0.11].map((off) => {
      const trim = new Mesh(
        taperedTube(edge, { radius: () => 0.04, sides: 6 }),
        rib,
      );
      trim.position.z = off;
      return trim;
    });
    const arch = new Group();
    arch.add(lintel, ...trims);
    if (door.along === "z") {
      arch.rotation.y = -Math.PI / 2;
      arch.position.x = door.at;
    } else arch.position.z = door.at;
    group.add(arch);
  }
  // The hall's barrel vault, its inside painted as a night sky with glowing stars, and gold ribs every two metres.
  const vault = new Mesh(
    new CylinderGeometry(3, 3, 14, 32, 1, true, -Math.PI / 2, Math.PI),
    painted(rooms.tones.hall, {
      color: "#1c2257",
      emissive: "#fff3d6",
      emissiveIntensity: 1.4,
      emissiveMap: starMap(71),
      side: DoubleSide,
    }),
  );
  vault.rotation.x = -Math.PI / 2;
  // A low vault, half as high as it is wide, under the dip of the roof.
  vault.scale.z = 0.5;
  vault.position.set(0, wallHeight - 0.3, 7);
  group.add(vault);
  for (let z = 1; z < 14; z += 2) {
    const ring = new Mesh(new TorusGeometry(2.98, 0.05, 6, 40, Math.PI), rib);
    ring.scale.y = 0.5;
    ring.position.set(0, wallHeight - 0.3, z);
    group.add(ring);
  }
  group.add(buildOutside(rooms, rib));
  return { group };
}
