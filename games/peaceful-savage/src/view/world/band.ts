import {
  CylinderGeometry,
  type Material,
  Mesh,
  Object3D,
  SphereGeometry,
  BoxGeometry,
} from "three";

import type { Tone } from "../palette.ts";
import { band } from "../show.ts";
import { toon } from "../toon.ts";

// The band's instruments, played by ancestors (see crowd.ts): a drum kit in the middle at the back of the stage, keys at the screen's
// left and strings at its right. Simple shapes in the storybook colours, gold where the light catches them.
export interface Instruments {
  readonly group: Object3D;
  readonly materials: readonly Material[];
  // The drums move with the beat: `beat` runs 0 to 1 over each.
  update(beat: number): void;
}

export function buildInstruments(tone: Tone, top: number): Instruments {
  const shell = toon(tone, { color: "#7c2bd4", rim: 0.3 });
  const skin = toon(tone, { color: "#f3e7cf" });
  const chrome = toon(tone, { color: "#c9c9d6", rim: 0.4 });
  const gold = toon(tone, {
    color: "#e8b04a",
    emissive: "#8a5a10",
    rim: 0.5,
  });
  const black = toon(tone, { color: "#1d1626" });
  const wood = toon(tone, { color: "#8a4a22" });
  const materials = [shell, skin, chrome, gold, black, wood];
  for (const material of materials) material.transparent = true;
  const group = new Object3D();
  const put = (
    geometry: CylinderGeometry | SphereGeometry | BoxGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
  ): Mesh => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  // The drums: a big drum on its side, a snare, two toms on it, and a cymbal and a hi-hat on stands.
  const d = band.drums;
  const kick = put(
    new CylinderGeometry(0.3, 0.3, 0.32, 20).rotateX(Math.PI / 2),
    shell,
    d.x,
    top + 0.3,
    d.z - 0.2,
  );
  put(
    new CylinderGeometry(0.28, 0.28, 0.33, 20).rotateX(Math.PI / 2),
    skin,
    d.x,
    top + 0.3,
    d.z - 0.21,
  ).scale.set(1, 1, 0.98);
  const toms = [-0.2, 0.2].map((x) =>
    put(
      new CylinderGeometry(0.15, 0.15, 0.16, 16),
      shell,
      d.x + x,
      top + 0.72,
      d.z - 0.1,
    ),
  );
  put(
    new CylinderGeometry(0.17, 0.17, 0.12, 16),
    shell,
    d.x - 0.45,
    top + 0.55,
    d.z - 0.25,
  );
  for (const [x, height, radius] of [
    [0.55, 1.1, 0.26],
    [-0.62, 0.85, 0.2],
  ] as const) {
    put(
      new CylinderGeometry(0.012, 0.012, height, 6),
      chrome,
      d.x + x,
      top + height / 2,
      d.z,
    );
    put(
      new CylinderGeometry(radius, radius * 0.9, 0.02, 20),
      gold,
      d.x + x,
      top + height,
      d.z,
    );
  }
  // The keys: a long black keyboard with its white keys, on a crossed stand.
  const k = band.keys;
  put(new BoxGeometry(1.1, 0.08, 0.32), black, k.x, top + 0.86, k.z);
  put(new BoxGeometry(1.02, 0.02, 0.14), skin, k.x, top + 0.91, k.z - 0.06);
  for (const lean of [0.5, -0.5]) {
    const leg = put(
      new BoxGeometry(0.04, 0.95, 0.04),
      chrome,
      k.x,
      top + 0.42,
      k.z,
    );
    leg.rotation.z = lean;
  }
  // The strings: a guitar, held across the player's body.
  const s = band.strings;
  const guitar = new Object3D();
  guitar.position.set(s.x, top + 0.98, s.z - 0.25);
  guitar.rotation.set(0, 0, 0.9);
  group.add(guitar);
  for (const [y, size] of [
    [-0.12, 0.2],
    [0.08, 0.15],
  ] as const) {
    const body = new Mesh(
      new SphereGeometry(size, 16, 12).scale(1, 1, 0.3),
      wood,
    );
    body.position.y = y;
    guitar.add(body);
  }
  const neck = new Mesh(new BoxGeometry(0.06, 0.6, 0.03), black);
  neck.position.y = 0.48;
  guitar.add(neck);
  return {
    group,
    materials,
    update(beat) {
      // A thump on the beat: the big drum swells a little and the toms bounce.
      const hit = Math.max(0, 1 - beat * 4);
      kick.scale.setScalar(1 + hit * 0.06);
      for (const tom of toms) tom.position.y = top + 0.72 + hit * 0.02;
    },
  };
}
