import {
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  type Material,
  type Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";

import { glowing, noise } from "../palette.ts";
import type { Look } from "./looks.ts";

// One tight curl: a little helix of two and a half turns. Thousands of these, as instances, make coily hair.
export function coilGeometry(detail: number): BufferGeometry {
  const points: Vector3[] = [];
  const steps = 10 * detail;
  for (let at = 0; at <= steps; at += 1) {
    const t = at / steps;
    const angle = t * Math.PI * 2 * 2.5;
    points.push(
      new Vector3(Math.cos(angle) * 0.33, t - 0.5, Math.sin(angle) * 0.33),
    );
  }
  return new TubeGeometry(
    new CatmullRomCurve3(points),
    steps * 2,
    0.1,
    2 + detail,
    false,
  );
}

const galaxyColours = [
  "#331a66",
  "#2a2b78",
  "#5d3aa8",
  "#1d7d86",
  "#7b2d78",
  "#241450",
];

export interface Volume {
  readonly count: number;
  // Whether a curl may grow at a point of the head (in the head's own space): the face and the ears are left bare.
  readonly keep: (at: Vector3) => boolean;
  readonly radii: Vector3;
  readonly size: number;
}

// A point in the volume the keeper allows, densest at the outer shell (outer) or anywhere inside.
function spotIn(
  parent: Object3D,
  volume: Volume,
  random: () => number,
  outer: boolean,
): Vector3 {
  let position = new Vector3(0, volume.radii.y, 0);
  for (let tries = 0; tries < 24; tries += 1) {
    const direction = new Vector3(
      random() * 2 - 1,
      random() * 2 - 1,
      random() * 2 - 1,
    ).normalize();
    const reach = outer ? 0.86 + random() * 0.14 : 0.45 + random() * 0.4;
    position = direction.multiply(volume.radii).multiplyScalar(reach);
    if (volume.keep(position.clone().add(parent.position))) return position;
  }
  return position;
}

// A cloud of curls in an ellipsoid, as instances on `parent`, each turned to grow outward with a twist of its own.
export function curls(
  parent: Object3D,
  volume: Volume,
  material: Material,
  look: Look,
  seed: number,
  detail: number,
): InstancedMesh {
  const random = noise(seed);
  const mesh = new InstancedMesh(coilGeometry(detail), material, volume.count);
  const base = new Color(look.hairColour);
  const matrix = new Matrix4();
  const up = new Vector3(0, 1, 0);
  for (let at = 0; at < volume.count; at += 1) {
    const outer = random() < 0.72;
    const position = spotIn(parent, volume, random, outer);
    const spin = new Quaternion()
      .setFromUnitVectors(up, position.clone().normalize())
      .multiply(new Quaternion().setFromAxisAngle(up, random() * Math.PI * 2));
    const scale = volume.size * (0.6 + random() * 0.8);
    matrix.compose(
      position,
      spin,
      new Vector3(scale, scale * (0.8 + random() * 0.5), scale),
    );
    mesh.setMatrixAt(at, matrix);
    const tint = look.galaxy
      ? new Color(
          galaxyColours[Math.floor(random() * galaxyColours.length)] ??
            look.hairColour,
        )
      : base.clone().offsetHSL(0, 0, (random() - 0.5) * 0.06);
    mesh.setColorAt(at, tint.multiplyScalar(outer ? 1 : 0.55));
  }
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// Stars caught in galaxy hair: little points of light, and for Mama a planet or two with rings.
export function stars(
  parent: Object3D,
  volume: Volume,
  seed: number,
  planets: boolean,
): void {
  const random = noise(seed);
  const star = new InstancedMesh(
    new SphereGeometry(1, 6, 4),
    glowing("#fff3c4", 3),
    volume.count,
  );
  const matrix = new Matrix4();
  for (let at = 0; at < volume.count; at += 1) {
    const size = volume.radii.x * (0.012 + random() * 0.02);
    matrix.compose(
      spotIn(parent, volume, random, true),
      new Quaternion(),
      new Vector3(size, size, size),
    );
    star.setMatrixAt(at, matrix);
  }
  parent.add(star);
  if (!planets) return;
  const r = volume.radii;
  for (const [x, y, colour] of [
    [0.7, 0.5, "#f2a541"],
    [-0.6, 0.65, "#7fd6c8"],
  ] as const) {
    const planet = new Mesh(
      new SphereGeometry(r.x * 0.09, 14, 10),
      glowing(colour, 0.6),
    );
    planet.position.set(x * r.x, y * r.y, 0.55 * r.z);
    const ring = new Mesh(
      new TorusGeometry(r.x * 0.15, r.x * 0.012, 6, 28),
      glowing("#ffd27a", 1.2),
    );
    ring.rotation.x = 1.2;
    planet.add(ring);
    parent.add(planet);
  }
}
