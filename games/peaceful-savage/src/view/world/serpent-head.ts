import {
  Group,
  Mesh,
  MeshStandardMaterial,
  type MeshToonMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";

import { texture } from "../palette.ts";

// The giant snake's scales and head (see serpent.ts).
// Scales: rows of overlapping half-circles, each edged in a fine line that glows gold once healed.
export function scales() {
  return texture(
    64,
    (x, y) => {
      const row = Math.floor(y / 16);
      const shift = row % 2 === 0 ? 0 : 8;
      const cx = Math.floor((x + shift) / 16) * 16 + 8 - shift;
      const d = Math.hypot(x - cx, (y % 16) - 2);
      const edge = Math.abs(d - 9) < 1.1;
      return edge ? [255, 215, 120, 255] : [0, 0, 0, 255];
    },
    1,
  );
}

export interface Head {
  readonly made: Group;
  readonly irises: readonly Mesh[];
  readonly lids: readonly Mesh[];
}

export function head(skin: MeshToonMaterial): Head {
  const made = new Group();
  const skull = new Mesh(new SphereGeometry(1, 28, 18), skin);
  skull.scale.set(0.95, 0.62, 1.35);
  const snout = new Mesh(new SphereGeometry(1, 24, 14), skin);
  snout.scale.set(0.7, 0.42, 0.7);
  snout.position.set(0, -0.12, 0.95);
  made.add(skull, snout);
  const lids: Mesh[] = [];
  const irises: Mesh[] = [];
  for (const s of [1, -1]) {
    const eye = new Mesh(
      new SphereGeometry(0.24, 16, 12),
      new MeshStandardMaterial({ color: "#f4eedf", roughness: 0.35 }),
    );
    eye.position.set(s * 0.55, 0.22, 0.78);
    const iris = new Mesh(
      new SphereGeometry(0.13, 12, 10),
      new MeshStandardMaterial({ color: "#5a4a7a", roughness: 0.2 }),
    );
    iris.position.set(s * 0.02, -0.04, 0.16);
    eye.add(iris);
    // A heavy upper lid, tipped down at the outer corner: shut while it sleeps, half shut awake (sorrowful, not fierce).
    const lid = new Mesh(
      new SphereGeometry(0.27, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      skin,
    );
    lid.position.copy(eye.position);
    lid.rotation.set(1.5, 0, s * -0.35);
    const brow = new Mesh(new TorusGeometry(0.22, 0.04, 6, 16, Math.PI), skin);
    brow.position.set(s * 0.55, 0.47, 0.82);
    brow.rotation.set(0, 0, s * 0.3);
    made.add(eye, lid, brow);
    lids.push(lid);
    irises.push(iris);
  }
  return { irises, lids, made };
}
