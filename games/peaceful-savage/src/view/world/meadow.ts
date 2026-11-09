import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";

import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { brushed, noise, painted, type Tone } from "../palette.ts";
import { blossom, flowerPaint } from "./flowers.ts";

// The meadow at the red rim of town: rolling ground (flat by the house, rising to the hill where the giant sly snake gathers), grass that
// moves in the wind, the book's wildflowers (lupines, poppies, daisies, bluebells) glowing softly, the winding golden road, the hedges,
// and round storybook trees standing all along its edges. (The night sky over it is the sky's own.)
export function groundAt(x: number, z: number): number {
  if (z > -0.5) return 0;
  const away = Math.min(1, (-z - 0.5) / 6);
  const hill = 2.4 * Math.exp(-((x * x) / 60 + ((z + 18) * (z + 18)) / 40));
  const roll =
    0.35 * Math.sin(x * 0.21) * Math.cos(z * 0.17) +
    0.25 * Math.sin((x + z) * 0.09);
  return away * (hill + roll + 0.2);
}

export interface Meadow {
  readonly group: Group;
  // The time, for the wind in the grass.
  update(time: number): void;
}

function terrain(tone: Tone): Mesh {
  const geometry = new PlaneGeometry(64, 34, 96, 52);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position");
  for (let at = 0; at < position.count; at += 1) {
    const x = position.getX(at);
    const z = position.getZ(at) - 16.5;
    position.setXYZ(at, x, groundAt(x, z), z);
  }
  geometry.computeVertexNormals();
  const ground = new Mesh(
    geometry,
    painted(tone, {
      color: "#7fbf6a",
      map: brushed("#7fbf6a", 81, 10),
    }),
  );
  ground.receiveShadow = true;
  return ground;
}

// Round storybook trees along the meadow's edges and its far side: puffed canopies on curved trunks, a few big, many small.
function forest(tone: Tone): Group {
  const random = noise(91);
  const group = new Group();
  const spots: [number, number][] = [];
  for (let at = 0; at < 70; at += 1) {
    const side = at % 3;
    const x =
      side === 2
        ? (random() - 0.5) * 56
        : (side === 0 ? -1 : 1) * (16 + random() * 12);
    const z = side === 2 ? -27 - random() * 4 : -3 - random() * 25;
    spots.push([x, z]);
  }
  const trunks = new InstancedMesh(
    new ConeGeometry(0.22, 2.6, 6, 1).translate(0, 1.3, 0),
    painted(tone, { color: "#3a2a4a" }),
    spots.length,
  );
  const crowns = new InstancedMesh(
    new SphereGeometry(1, 14, 10),
    painted(tone, { color: "#ffffff" }),
    spots.length * 3,
  );
  const matrix = new Matrix4();
  const tint = ["#2d4f6e", "#3b3f7a", "#24586a", "#4a3a7a"];
  spots.forEach(([x, z], index) => {
    const size = 0.8 + random() * 1.1;
    const ground = groundAt(x, z);
    matrix.compose(
      new Vector3(x, ground, z),
      new Quaternion(),
      new Vector3(size, size, size),
    );
    trunks.setMatrixAt(index, matrix);
    for (let puff = 0; puff < 3; puff += 1) {
      const lift = (2.2 + puff * 0.55) * size;
      const off = new Vector3(
        (random() - 0.5) * 1.2 * size,
        lift,
        (random() - 0.5) * 1.2 * size,
      );
      const scale = size * (1.25 - puff * 0.25);
      matrix.compose(
        new Vector3(x, ground, z).add(off),
        new Quaternion(),
        new Vector3(scale, scale * 0.9, scale),
      );
      crowns.setMatrixAt(index * 3 + puff, matrix);
      crowns.setColorAt(
        index * 3 + puff,
        new Color(tint[Math.floor(random() * tint.length)] ?? "#2d4f6e"),
      );
    }
  });
  group.add(trunks, crowns);
  return group;
}

// A tuft of grass: five thin blades leaning out from one root, a hand high.
function tuft(): BufferGeometry {
  const blades: BufferGeometry[] = [];
  for (let blade = 0; blade < 5; blade += 1) {
    const one = new ConeGeometry(0.018, 0.3 - blade * 0.025, 3, 1).translate(
      0,
      0.15 - blade * 0.0125,
      0,
    );
    one.rotateZ(0.12 + blade * 0.05);
    one.rotateY((blade / 5) * Math.PI * 2);
    blades.push(one);
  }
  return mergeGeometries(blades) ?? new ConeGeometry(0.02, 0.3, 3, 1);
}

// Instanced blades or flowers scattered over the meadow, away from the road and the house.
function scatter(
  count: number,
  seed: number,
  geometry: BufferGeometry,
  material: MeshBasicMaterial | ReturnType<typeof painted>,
  size: number,
  colours: readonly string[],
): InstancedMesh {
  const random = noise(seed);
  const mesh = new InstancedMesh(geometry, material, count);
  const matrix = new Matrix4();
  for (let at = 0; at < count; at += 1) {
    let x = (random() - 0.5) * 60;
    const z = -1.5 - random() * 30;
    // The lawn before the front door, where the family stands to be chosen and the camera looks on, is kept short: nothing grows there.
    if (Math.abs(x) < 4.5 && z > -14) x += Math.sign(x || 1) * 4.5;
    const scale = size * (0.6 + random() * 0.8);
    matrix.compose(
      new Vector3(x, groundAt(x, z), z),
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        random() * Math.PI * 2,
      ),
      new Vector3(scale, scale * (0.8 + random() * 0.6), scale),
    );
    mesh.setMatrixAt(at, matrix);
    mesh.setColorAt(
      at,
      new Color(colours[Math.floor(random() * colours.length)] ?? "#ffffff"),
    );
  }
  return mesh;
}

export function buildMeadow(tone: Tone, amount: number): Meadow {
  const group = new Group();
  group.add(terrain(tone));
  // Grass that bends in the wind: the shader sways each blade by its height.
  const wind = { value: 0 };
  const grassMaterial = painted(tone, { color: "#ffffff" });
  const previous = grassMaterial.onBeforeCompile;
  grassMaterial.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.savageWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float savageWind;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfloat sway = sin(savageWind * 1.7 + instanceMatrix[3].x * 0.4 + instanceMatrix[3].z * 0.3) * 0.25;\ntransformed.x += sway * position.y * position.y;",
      );
  };
  grassMaterial.customProgramCacheKey = () => "savage-grass";
  group.add(
    scatter(Math.round(9_000 * amount), 83, tuft(), grassMaterial, 1, [
      "#3f8a46",
      "#2e6b3a",
      "#5aa14a",
      "#4a7f3a",
    ]),
  );
  // The wildflowers glow a little in the dark, as the book's do.
  group.add(
    scatter(Math.round(2_200 * amount), 85, blossom(), flowerPaint(tone), 1, [
      "#7b5bd8",
      "#d8402f",
      "#f6efe0",
      "#4f6fd8",
      "#c05ad0",
      "#ffcf5a",
    ]),
  );
  // The winding golden road, from the front door away over the hill.
  const road = new CatmullRomCurve3(
    [
      new Vector3(0, 0.03, -1),
      new Vector3(1.5, 0, -6),
      new Vector3(-2, 0, -11),
      new Vector3(3, 0, -16),
      new Vector3(-1, 0, -24),
      new Vector3(4, 0, -32),
    ].map((point) => point.setY(groundAt(point.x, point.z) + 0.04)),
  );
  const roadMesh = new Mesh(
    new TubeGeometry(road, 120, 0.9, 6, false),
    painted(tone, {
      color: "#e3b04a",
      emissive: "#c88a2a",
      emissiveIntensity: 0.25,
    }),
  );
  roadMesh.scale.y = 0.05;
  roadMesh.position.y = 0.02;
  group.add(roadMesh);
  // Hedges either side of the house.
  for (const x of [-21, 21]) {
    const hedge = new Mesh(
      new SphereGeometry(1, 16, 8),
      painted(tone, { color: "#2c4f33" }),
    );
    hedge.scale.set(9, 1.1, 0.8);
    hedge.position.set(x, 0.3, 0);
    group.add(hedge);
  }
  group.add(forest(tone));
  return {
    group,
    update(time) {
      wind.value = time;
    },
  };
}
