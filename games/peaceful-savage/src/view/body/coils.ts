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

// One tight coil: a little spring of three and a half turns, thin as a strand. Tens of thousands of these, as instances, make coily
// hair: packed so close that no single one is seen, only the texture of them, and a soft outline where their ends stand free.
export function coilGeometry(detail: number): BufferGeometry {
  const points: Vector3[] = [];
  const steps = 9 + detail * 6;
  for (let at = 0; at <= steps; at += 1) {
    const t = at / steps;
    const angle = t * Math.PI * 2 * 3.5;
    points.push(
      new Vector3(Math.cos(angle) * 0.3, t - 0.5, Math.sin(angle) * 0.3),
    );
  }
  return new TubeGeometry(
    new CatmullRomCurve3(points),
    steps + 3,
    0.11,
    3,
    false,
  );
}

// Galaxy hair: deep indigo and violet, with drifts of magenta and teal through it like a nebula (never confetti).
const galaxy = ["#22124f", "#3a1f7c", "#5d3aa8", "#8a3aa0", "#1d7d86"].map(
  (tone) => new Color(tone),
);

export interface Volume {
  readonly count: number;
  // How many more fine coils stand free beyond the outline, as a part of `count` (the soft halo of an afro or a puff); none if left out.
  readonly halo?: number;
  // Whether a curl may grow at a point of the head (in the head's own space): the face and the ears are left bare.
  readonly keep: (at: Vector3) => boolean;
  readonly radii: Vector3;
  readonly size: number;
}

// The outline of a head of coils is never a perfect ball: it swells and dips a little, differently for every head.
const lumps = (d: Vector3, seed: number): number =>
  Math.sin(d.x * 3.1 + seed) * Math.sin(d.y * 2.7 + seed * 1.7) +
  Math.sin(d.z * 3.7 + seed * 0.6) * Math.sin(d.x * 5.3 - d.y * 4.1 + seed);

// A point in the volume the keeper allows, between `from` and `to` of the way out to its outline.
function spotIn(
  parent: Object3D,
  volume: Volume,
  random: () => number,
  from: number,
  to: number,
  seed = 0,
): { at: Vector3; depth: number; drift: number } {
  let at = new Vector3(0, volume.radii.y, 0);
  let depth = 1;
  let drift = 0;
  for (let tries = 0; tries < 24; tries += 1) {
    const direction = new Vector3(
      random() * 2 - 1,
      random() * 2 - 1,
      random() * 2 - 1,
    ).normalize();
    drift = lumps(direction, seed);
    depth = random();
    const reach = (from + (to - from) * depth) * (1 + drift * 0.035);
    at = direction.multiply(volume.radii).multiplyScalar(reach);
    if (volume.keep(at.clone().add(parent.position))) break;
  }
  return { at, depth, drift };
}

// A cloud of coils in an ellipsoid, as instances on `parent`: packed through its outer shell, each growing outward with a lean and a
// twist of its own, dark at the root and catching the light at the tip; and a halo of finer ones standing free of the outline.
export function curls(
  parent: Object3D,
  volume: Volume,
  material: Material,
  look: Look,
  seed: number,
  detail: number,
): InstancedMesh {
  const random = noise(seed);
  const halo = Math.round(volume.count * (volume.halo ?? 0));
  const mesh = new InstancedMesh(
    coilGeometry(detail),
    material,
    volume.count + halo,
  );
  const base = new Color(look.hairColour);
  const tip = base.clone().lerp(new Color("#8a5a34"), 0.16);
  const matrix = new Matrix4();
  const up = new Vector3(0, 1, 0);
  const lean = new Vector3();
  for (let at = 0; at < volume.count + halo; at += 1) {
    const free = at >= volume.count;
    const spot = free
      ? spotIn(parent, volume, random, 0.98, 1.06, seed)
      : spotIn(parent, volume, random, 0.78, 1, seed);
    // Outward, leaning its own way: coils tangle, they do not stand like pins.
    lean
      .set(random() - 0.5, random() - 0.5, random() - 0.5)
      .multiplyScalar(free ? 1.6 : 1.1)
      .add(spot.at.clone().normalize());
    const spin = new Quaternion()
      .setFromUnitVectors(up, lean.normalize())
      .multiply(new Quaternion().setFromAxisAngle(up, random() * Math.PI * 2));
    const scale = volume.size * (0.7 + random() * 0.6);
    matrix.compose(
      spot.at,
      spin,
      free
        ? new Vector3(
            scale * 0.75,
            scale * (0.9 + random() * 0.5),
            scale * 0.75,
          )
        : new Vector3(scale, scale * (0.9 + random() * 0.7), scale),
    );
    mesh.setMatrixAt(at, matrix);
    const light = free ? 1 : spot.depth;
    let tint: Color;
    if (look.galaxy) {
      const band = (spot.drift + 2) / 4 + (random() - 0.5) * 0.16;
      const pick = Math.min(4, Math.max(0, Math.floor(band * 5)));
      tint = (galaxy[pick] ?? base).clone();
      tint.multiplyScalar(0.3 + 0.55 * light);
    } else
      tint = base
        .clone()
        .multiplyScalar(0.5 + 0.4 * light)
        .lerp(tip, light * light * random());
    mesh.setColorAt(at, tint);
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
      spotIn(parent, volume, random, 0.9, 1.02).at,
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
