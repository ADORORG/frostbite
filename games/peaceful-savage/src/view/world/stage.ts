import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
  type Vector3,
} from "three";

import { farewell, stageShown } from "../farewell.ts";
import type { Tone } from "../palette.ts";
import { micAt, stage } from "../show.ts";
import { toon } from "../toon.ts";
import { buildInstruments } from "./band.ts";
import { groundAt } from "./meadow.ts";

// The stage for the show at the end (see show.ts): a plum-wood platform with a gold edge on the lawn, a microphone for each of the
// family, a stack of speakers either side, the band's instruments, and a truss of coloured lamps whose beams sweep the stage to the beat.
// It all fades in as the family dances to it and out once the show is over. A gold ring lies under the one the player moves.
export interface Stage {
  readonly group: Group;
  // The seconds since the tree was lit (null before), the time, and where the one the player moves stands (or null).
  update(since: number | null, time: number, marked: Vector3 | null): void;
}

// The show's tempo, in beats a second (a hundred a minute).
export const beatsPerSecond = 100 / 60;

const lampColours = [
  "#ffcf6a",
  "#4fe0d2",
  "#ff6fb8",
  "#9d7bff",
  "#ffcf6a",
  "#4fe0d2",
];

export function buildStage(tone: Tone): Stage {
  const group = new Group();
  group.name = "stage";
  const set = new Object3D();
  group.add(set);
  const plum = toon(tone, { color: "#3b2350", rim: 0.3 });
  const step = toon(tone, { color: "#2c1a3c" });
  const gold = toon(tone, { color: "#ffd27a", emissive: "#a86f12" });
  const dark = toon(tone, { color: "#241a33", rim: 0.35 });
  const metal = toon(tone, { color: "#8f8aa3", rim: 0.4 });
  const cone = toon(tone, { color: "#0f0b16", emissive: "#163a3a" });
  const solid: Material[] = [plum, step, gold, dark, metal, cone];
  const put = (
    geometry: BoxGeometry | CylinderGeometry | SphereGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
  ): Mesh => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    set.add(mesh);
    return mesh;
  };
  const width = stage.left - stage.right;
  const depth = stage.back - stage.front;
  const middleZ = (stage.back + stage.front) / 2;
  // The platform, sunk a little into the lawn so no gap shows under it, its gold edge, and steps up at the back.
  put(
    new BoxGeometry(width, stage.top + 0.4, depth),
    plum,
    0,
    (stage.top - 0.4) / 2,
    middleZ,
  );
  put(
    new BoxGeometry(width + 0.04, 0.06, 0.06),
    gold,
    0,
    stage.top - 0.02,
    stage.front,
  );
  for (const [rise, out] of [
    [0.24, 0.5],
    [0.48, 0.25],
  ] as const)
    put(
      new BoxGeometry(2.2, rise + 0.3, 0.26),
      step,
      0,
      (rise - 0.3) / 2,
      stage.back + out,
    );
  // A microphone at the front for each of the family.
  for (const line of [0, 1, 2, 3]) {
    const at = micAt(line);
    put(
      new CylinderGeometry(0.15, 0.17, 0.03, 18),
      metal,
      at.x,
      stage.top + 0.015,
      at.z,
    );
    put(
      new CylinderGeometry(0.012, 0.012, 1.32, 6),
      metal,
      at.x,
      stage.top + 0.66,
      at.z,
    );
    put(new SphereGeometry(0.05, 12, 10), dark, at.x, stage.top + 1.36, at.z);
    put(
      new CylinderGeometry(0.052, 0.052, 0.02, 12),
      gold,
      at.x,
      stage.top + 1.32,
      at.z,
    );
  }
  // Speakers either side, on the lawn: two cabinets, each with its cones facing out.
  for (const side of [1, -1]) {
    const x = side * (stage.left + 0.75);
    const z = stage.front + 0.6;
    const floor = groundAt(x, z);
    for (const [y, height] of [
      [0.8, 1.6],
      [1.95, 0.7],
    ] as const) {
      put(new BoxGeometry(0.85, height, 0.62), dark, x, floor + y, z);
      put(
        new CylinderGeometry(0.24, 0.24, 0.04, 20).rotateX(Math.PI / 2),
        cone,
        x,
        floor + y + (height > 1 ? -0.25 : 0),
        z - 0.32,
      );
    }
  }
  // The truss: two posts and a bar overhead, with six lamps whose beams sweep down over the stage.
  const barY = stage.top + 3.9;
  const trussZ = stage.back - 0.25;
  for (const side of [1, -1])
    put(
      new BoxGeometry(0.16, barY + 0.4, 0.16),
      metal,
      side * (stage.left + 0.15),
      barY / 2 - 0.2,
      trussZ,
    );
  put(new BoxGeometry(width + 0.5, 0.18, 0.18), metal, 0, barY, trussZ);
  const beams = lampColours.map((colour, index) => {
    const x =
      stage.right + 0.6 + (index / (lampColours.length - 1)) * (width - 1.2);
    const lamp = toon(tone, { color: colour, emissive: colour });
    solid.push(lamp);
    put(
      new CylinderGeometry(0.12, 0.16, 0.24, 12),
      lamp,
      x,
      barY - 0.16,
      trussZ,
    );
    const glow = new MeshBasicMaterial({
      blending: AdditiveBlending,
      color: colour,
      depthWrite: false,
      opacity: 0,
      side: DoubleSide,
      transparent: true,
    });
    const beam = new Mesh(
      new ConeGeometry(0.75, barY - 0.2, 20, 1, true).translate(
        0,
        -(barY - 0.2) / 2,
        0,
      ),
      glow,
    );
    beam.position.set(x, barY - 0.2, trussZ);
    set.add(beam);
    return { beam, glow, phase: index * 1.1 };
  });
  const instruments = buildInstruments(tone, stage.top);
  set.add(instruments.group);
  // The gold ring under the one the player moves.
  const ringPaint = new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: "#ffd27a",
    depthWrite: false,
    side: DoubleSide,
    transparent: true,
  });
  const ring = new Mesh(
    new RingGeometry(0.34, 0.44, 32).rotateX(-Math.PI / 2),
    ringPaint,
  );
  group.add(ring);
  const fading = [...solid, ...instruments.materials];
  for (const material of fading) material.transparent = true;
  return {
    group,
    update(since, time, marked) {
      const shown = since === null ? 0 : stageShown(since);
      set.visible = shown > 0.001;
      ring.visible = set.visible && marked !== null;
      if (!set.visible) return;
      for (const material of fading) material.opacity = shown;
      const beat = (time * beatsPerSecond) % 1;
      const playing =
        since !== null && since >= farewell.show[0] && since < farewell.show[1];
      for (const { beam, glow, phase } of beams) {
        beam.rotation.z = Math.sin(time * 0.9 + phase) * 0.35;
        beam.rotation.x = Math.cos(time * 0.7 + phase) * 0.2;
        glow.opacity = shown * (playing ? 0.1 + (1 - beat) * 0.08 : 0.05);
      }
      instruments.update(playing ? beat : 0.9);
      if (marked !== null) {
        ring.position.set(marked.x, stage.top + 0.03, marked.z);
        ringPaint.opacity = 0.55 + Math.sin(time * 5) * 0.25;
      }
    },
  };
}
