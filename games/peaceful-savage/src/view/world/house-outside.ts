import {
  BufferGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  type Material,
  Mesh,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import { frontDoor } from "../../rules/layout.ts";
import { taperedTube } from "../body/tube.ts";
import { brushed, glowing, painted, srgb, texture } from "../palette.ts";
import { metres, type Rooms } from "./rooms.ts";
import { archway, block } from "./shapes.ts";
import {
  inside,
  landing,
  stairLine,
  stairWide,
  treadRise,
  treads,
} from "./stair.ts";

// The house from the meadow, as the book paints it: one long shell of a roof like a wave, tall over the east wing, dipping low toward
// the door and rising again over the west wing easing down over each end wall; purple tiles like scales, each edged in
// gold; a thick cream lip all along its front. Under it the cream wall, a tall round-cornered window in the east wing, three ovals
// growing smaller toward the door, the round-topped door with its keyhole of light, and one great scooped window in the west wing
// with the tree's gold in it. Round steps lead up to the door.
const smooth = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};
// How high the roof's crown is along the house (x): a wave, easing down a little over each end wall.
export function crownAt(x: number): number {
  const wave =
    5.65 + 2 * smooth(2.5, 11.5, x) + Math.exp(-(((x + 8) / 4.5) ** 2));
  const past = Math.min(1, Math.max(0, Math.abs(x) - 11) / 1.7);
  return wave * (1 - 0.2 * past * past);
}
const lipAt = (x: number): number => Math.max(0, crownAt(x) - 1.6);
const ends = 12.7;
const [front, back] = [-1.4, 15.4];

// The tiles: rows of scales, each a rounded tongue of purple, darker toward its root, with a thin gold edge.
function tiles() {
  const [purple, deep, gold] = ["#7a52c0", "#4a2f86", "#e7b04a"].map((tone) =>
    srgb(new Color(tone)),
  );
  return texture(
    64,
    (x, y) => {
      const row = Math.floor(y / 32);
      const across = ((x + row * 16) % 32) - 16;
      const down = (y % 32) / 32;
      const tongue = Math.hypot(across / 16, down);
      const [r, g, b] = (tongue > 0.9 && tongue < 1.02
        ? gold
        : tongue >= 1.02
          ? deep
          : purple) ?? [122, 82, 192];
      const shade = tongue >= 1.02 ? 1 : 0.78 + 0.22 * down;
      return [r * shade, g * shade, b * shade, 255];
    },
    1,
  );
}

function roofShell(): BufferGeometry {
  const [across, along] = [28, 80];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= along; i += 1) {
    const x = -ends + (2 * ends * i) / along;
    for (let j = 0; j <= across; j += 1) {
      const v = j / across;
      const lip = lipAt(x);
      const y = lip + (crownAt(x) - lip) * Math.sin(Math.PI * v) ** 0.5;
      positions.push(x, y, front + (back - front) * v);
      uvs.push((i / along) * 22, v * 9);
    }
  }
  for (let i = 0; i < along; i += 1)
    for (let j = 0; j < across; j += 1) {
      const a = i * (across + 1) + j;
      const b = a + across + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildOutside(rooms: Rooms, rib: Material): Group {
  const group = new Group();
  const tone = rooms.tones.meadow;
  const scales = tiles();
  scales.repeat.set(1, 1);
  const roof = new Mesh(
    roofShell(),
    painted(tone, { color: "#ffffff", map: scales, side: DoubleSide }),
  );
  // The roof lets the moon in: it casts no shadow on the rooms under it.
  roof.castShadow = false;
  group.add(roof);
  const cream = painted(tone, {
    color: "#efe2c8",
    map: brushed("#f1e4cb", 46, 1, 0.4),
    side: DoubleSide,
  });
  // The lip: a thick roll of cream along the roof's front and back edges, a line of gold on it.
  for (const z of [front, back]) {
    const edge = Array.from({ length: 81 }, (_, step) => {
      const x = -ends + (2 * ends * step) / 80;
      return new Vector3(x, lipAt(x), z);
    });
    group.add(
      new Mesh(taperedTube(edge, { radius: () => 0.24, sides: 10 }), cream),
      new Mesh(
        taperedTube(
          edge.map((point) => point.clone().add(new Vector3(0, 0.2, 0))),
          { radius: () => 0.035, sides: 6 },
        ),
        glowing("#e7b04a", 1.2),
      ),
    );
    // The wall carried up from the top of the rooms' walls to the roof.
    const face = new Shape();
    face.moveTo(-12.1, 3.4);
    face.lineTo(12.1, 3.4);
    for (let x = 12.1; x >= -12.1; x -= 0.3) face.lineTo(x, lipAt(x) + 0.85);
    const wall = new Mesh(new ShapeGeometry(face), cream);
    wall.position.z = z < 7 ? 0 : 14;
    group.add(wall);
  }
  // The ends of the house: the wall carried up under the roof's curve.
  for (const x of [-12, 12]) {
    const gable = new Shape();
    gable.moveTo(0, 3.4);
    gable.lineTo(14, 3.4);
    for (let z = 14; z >= 0; z -= 0.25) {
      const v = (z - front) / (back - front);
      const lip = lipAt(x);
      gable.lineTo(
        z,
        lip + (crownAt(x) - lip) * Math.sin(Math.PI * v) ** 0.5 + 0.06,
      );
    }
    const end = new Mesh(new ShapeGeometry(gable).rotateY(-Math.PI / 2), cream);
    end.position.x = x;
    group.add(end);
  }
  // The front door: the shape of its archway, a keyhole of light on both its faces; it stands open (the porch and the meadow are part
  // of home).
  const wide = metres(frontDoor.x1 - frontDoor.x0);
  const outline = new Shape();
  archway(0, wide, 2.9).forEach(([across, up], index) => {
    if (index === 0) outline.moveTo(across, up);
    else outline.lineTo(across, up);
  });
  const leaf = new Mesh(
    new ExtrudeGeometry(outline, {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.03,
      bevelThickness: 0.03,
      depth: 0.06,
    }),
    painted(rooms.tones.hall, { color: "#c98f45" }),
  );
  const keyLight = glowing("#ffcf6a", 3);
  for (const z of [-0.05, 0.11]) {
    const bow = new Mesh(new TorusGeometry(0.2, 0.05, 8, 24), keyLight);
    bow.position.set(wide / 2, 1.75, z);
    const stem = new Mesh(
      taperedTube(
        [new Vector3(wide / 2, 1.55, z), new Vector3(wide / 2, 0.95, z)],
        { radius: (t) => 0.05 + t * 0.06, sides: 6 },
      ),
      keyLight,
    );
    leaf.add(bow, stem);
  }
  const door = new Group();
  door.add(leaf);
  door.position.set(metres(frontDoor.x0), 0, 0);
  door.rotation.y = 1.6;
  group.add(door);
  // Round steps up to the door and up to the office's tall window, each a low pad of warm stone.
  const stone = painted(tone, { color: "#c9b79a" });
  for (const x of [0, 9.4])
    for (const [reach, high] of [
      [1.9, 0.05],
      [1.4, 0.1],
    ] as const) {
      const step = new Mesh(new SphereGeometry(1, 28, 8), stone);
      step.scale.set(reach, high, reach * 0.62);
      step.position.set(x, 0, -0.35);
      step.receiveShadow = true;
      group.add(step);
    }
  // The raised stair to the kitchen's side door (stair.ts): six broad treads curving round the corner of the house, each a pebble of
  // stone higher than the last, a landing at the door and one step down inside.
  for (let tread = 0; tread < treads; tread += 1) {
    const here = stairLine((tread + 0.5) / treads);
    const next = stairLine((tread + 0.6) / treads);
    const high = (tread + 1) * treadRise;
    const slab = block(
      stone,
      [stairWide, high, 1.15],
      [here.x, high / 2, here.z],
    );
    slab.rotation.y = Math.atan2(next.x - here.x, next.z - here.z);
    group.add(slab);
  }
  for (const pad of [landing, inside])
    group.add(
      block(
        stone,
        [pad.x1 - pad.x0 + 0.3, pad.high, pad.z1 - pad.z0],
        [(pad.x0 + pad.x1) / 2, pad.high / 2, (pad.z0 + pad.z1) / 2],
      ),
    );
  // A gold rail sweeping up the outside of the stair.
  const rail = Array.from({ length: 13 }, (_, step) => {
    const t = step / 12;
    const [here, next] = [stairLine(t), stairLine(t + 0.02)];
    const along = Math.hypot(next.x - here.x, next.z - here.z) || 1;
    return new Vector3(
      here.x - ((next.z - here.z) / along) * (stairWide / 2),
      0.75 + t * landing.high,
      here.z + ((next.x - here.x) / along) * (stairWide / 2),
    );
  });
  group.add(
    new Mesh(taperedTube(rail, { radius: () => 0.035, sides: 6 }), rib),
  );
  return group;
}
