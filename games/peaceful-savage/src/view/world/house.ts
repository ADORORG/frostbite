import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from "three";

import type { ZoneId } from "../../rules/constants.ts";
import { zoneAt } from "../../rules/geometry.ts";
import { frontDoor, walls } from "../../rules/layout.ts";
import {
  brushed,
  glowing,
  painted,
  planks,
  starMap,
  tiles,
} from "../palette.ts";
import { metres, type Rooms } from "./rooms.ts";

// The Savage house: the rules' walls stood up three and a half metres, in warm painted plaster; floors of wood, tile and rug; a barrel
// vault over the hall like the book's round passages, with gold ribs; arches round every doorway; oval windows in the front wall; and
// outside a low, sweeping purple roof. Only the walls and furniture of the plan block a body; nothing here adds to them.
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
        }),
      ],
    ),
  );
  // Floors, each in its room's colour.
  floors.forEach((floor, index) => {
    const mesh = new Mesh(
      new PlaneGeometry(floor.x1 - floor.x0, floor.z1 - floor.z0),
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
    mesh.position.set(
      (floor.x0 + floor.x1) / 2,
      0.001,
      (floor.z0 + floor.z1) / 2,
    );
    mesh.receiveShadow = true;
    group.add(mesh);
    const ceiling = new Mesh(
      new PlaneGeometry(floor.x1 - floor.x0, floor.z1 - floor.z0),
      plaster[floor.zone],
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(
      (floor.x0 + floor.x1) / 2,
      floor.zone === "hall" ? wallHeight + 1.2 : wallHeight,
      (floor.z0 + floor.z1) / 2,
    );
    if (floor.zone !== "hall") group.add(ceiling);
  });
  // The walls of the house (not the meadow's hedges, which the meadow draws).
  for (const wall of walls.slice(0, 13)) {
    const width = metres(wall.x1 - wall.x0);
    const depth = metres(wall.z1 - wall.z0);
    const zone = zoneAt({
      x: (wall.x0 + wall.x1) / 2,
      z: Math.max(1, (wall.z0 + wall.z1) / 2),
    });
    const mesh = new Mesh(
      new BoxGeometry(width, wallHeight, depth),
      plaster[zone],
    );
    mesh.position.set(
      metres(wall.x0) + width / 2,
      wallHeight / 2,
      metres(wall.z0) + depth / 2,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // A line of gold round every wall at the top and at hand height: the house's own line-work.
  const line = glowing("#e7b04a", 0.9);
  for (const wall of walls.slice(0, 13))
    for (const height of [wallHeight - 0.18, 1.0]) {
      const strip = new Mesh(new BoxGeometry(1, 1, 1), line);
      strip.scale.set(
        metres(wall.x1 - wall.x0) + 0.03,
        0.035,
        metres(wall.z1 - wall.z0) + 0.03,
      );
      strip.position.set(
        metres(wall.x0 + wall.x1) / 2,
        height,
        metres(wall.z0 + wall.z1) / 2,
      );
      group.add(strip);
    }
  // The hall's barrel vault, with gold ribs every two metres.
  // Its inside is painted as a night sky, its stars glowing.
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
  vault.position.set(0, wallHeight - 0.3, 7);
  group.add(vault);
  const rib = glowing("#e7b04a", 0.6);
  for (let z = 1; z < 14; z += 2) {
    const ring = new Mesh(new TorusGeometry(2.98, 0.05, 6, 40, Math.PI), rib);
    ring.position.set(0, wallHeight - 0.3, z);
    group.add(ring);
  }
  // Arches round the doorways from the hall, and oval windows in the front wall glowing warm.
  for (const [x, z] of [
    [-3, 3.1],
    [3, 3.1],
    [-3, 10.3],
    [3, 10.3],
  ] as const) {
    const arch = new Mesh(new TorusGeometry(0.75, 0.09, 8, 28, Math.PI), rib);
    arch.position.set(x, 2.45, z);
    arch.rotation.y = Math.PI / 2;
    group.add(arch);
  }
  // Each window: lamplight inside, brightest in the middle, behind a gold frame and a cross of glazing bars.
  const glass = new MeshStandardMaterial({
    color: "#3a2450",
    emissive: "#e8964a",
    emissiveIntensity: 0.55,
    roughness: 0.2,
  });
  const lamp = new MeshStandardMaterial({
    color: "#ffd99a",
    emissive: "#ffcf7a",
    emissiveIntensity: 1.3,
    roughness: 0.4,
  });
  for (const x of [-9.5, -6.5, 6.5, 9.5]) {
    const window = new Mesh(new SphereGeometry(1, 24, 12), glass);
    window.scale.set(0.7, 1.05, 0.05);
    window.position.set(x, 1.9, -0.11);
    const inside = new Mesh(new SphereGeometry(1, 20, 10), lamp);
    inside.scale.set(0.42, 0.66, 0.05);
    inside.position.set(x, 1.85, -0.12);
    const frame = new Mesh(new TorusGeometry(1, 0.06, 8, 40), rib);
    frame.scale.set(0.7, 1.05, 1);
    frame.position.set(x, 1.9, -0.13);
    const bars = [
      new Mesh(new BoxGeometry(0.035, 2.05, 0.03), rib),
      new Mesh(new BoxGeometry(1.36, 0.035, 0.03), rib),
    ];
    for (const bar of bars) bar.position.set(x, 1.9, -0.15);
    group.add(window, inside, frame, ...bars);
  }
  // The roof seen from the meadow: a long, low purple shell.
  const roof = new Mesh(
    new SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    painted(rooms.tones.meadow, {
      color: "#ffffff",
      map: brushed("#7a52c0", 77, 4, 0.6),
    }),
  );
  roof.scale.set(12.15, 2.9, 7.15);
  roof.position.set(0, wallHeight, 7);
  // The roof lets the moon in: it casts no shadow on the rooms under it.
  roof.castShadow = false;
  group.add(roof);
  // A line of gold where the roof meets the walls.
  const eave = new Mesh(
    new TorusGeometry(1, 0.012, 6, 96),
    glowing("#e7b04a", 1.2),
  );
  eave.rotation.x = Math.PI / 2;
  eave.scale.set(12.2, 7.2, 1);
  eave.position.set(0, wallHeight + 0.02, 7);
  group.add(eave);
  // The front door, round-topped, with its keyhole of light.
  const door = new Group();
  const leaf = new Mesh(
    new BoxGeometry(metres(frontDoor.x1 - frontDoor.x0), 2.4, 0.12),
    painted(rooms.tones.hall, { color: "#c98f45" }),
  );
  leaf.position.set(metres(frontDoor.x1 - frontDoor.x0) / 2, 1.2, 0);
  const keyhole = new Mesh(
    new SphereGeometry(0.07, 10, 8),
    glowing("#ffcf6a", 3),
  );
  keyhole.position.set(metres(frontDoor.x1 - frontDoor.x0) * 0.82, 1.15, -0.08);
  leaf.add(keyhole);
  door.add(leaf);
  door.position.set(metres(frontDoor.x0), 0, 0);
  // The front door stands open from the start: the porch and the meadow are part of home.
  door.rotation.y = 1.6;
  group.add(door);
  return { group };
}
