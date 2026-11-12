import { Color, Mesh, Object3D, Vector3 } from "three";

import type { Tone } from "../palette.ts";
import { inked, inkMaterial, toon } from "../toon.ts";
import { buildEye, type Eye, irisTexture } from "./eyes.ts";
import { earGeometry, type Expression, headGeometry } from "./head.ts";
import { headOf } from "./head-shape.ts";
import type { Look } from "./looks.ts";
import { buildPortrait } from "./portrait.ts";
import type { Rig } from "./rig.ts";

// The face: a sculpted head (skull, cheeks, jaw and chin, brow, nose and lips) with its features painted on (brows, the lines of the nose,
// the lips and the mouth of each feeling), real eyes set in its sockets that look at what the head turns to and blink, and ears. Inked
// round like the body.
export type { Expression } from "./head.ts";

export interface Face {
  blink(closed: number): void;
  brows(lift: number): void;
  look(yaw: number, pitch: number): void;
  show(expression: Expression): void;
}

// How open the upper lid sits for each feeling, and where the lower lid rests (smiles lift it).
const lidsFor: Readonly<Record<Expression, readonly [number, number]>> = {
  calm: [-0.6, 0.8],
  open: [-0.92, 0.84],
  smile: [-0.62, 0.56],
  smirk: [-0.58, 0.66],
  worry: [-0.74, 0.76],
};

export function buildFace(rig: Rig, look: Look, tone: Tone): Face {
  const r = rig.build.head;
  const shape = headOf(look.face);
  const portrait = buildPortrait(
    look,
    shape.layout,
    look.face.young,
    look.name.length * 131,
  );
  const skin = toon(tone, { color: look.skin, rim: 0.22, soft: true });
  const head = new Mesh(
    headGeometry(shape),
    toon(tone, {
      color: "#ffffff",
      map: portrait.texture,
      rim: 0.22,
      soft: true,
    }),
  );
  head.castShadow = true;
  head.add(new Mesh(headGeometry(shape, true), inkMaterial(0.04)));
  const frame = new Object3D();
  frame.position.set(0, r * 0.88, 0.005);
  frame.scale.setScalar(r);
  rig.joint("head").add(frame);
  frame.add(head);
  const shell = earGeometry();
  for (const s of [1, -1] as const) {
    const { at, size } = shape.ear(s);
    const ear = new Mesh(shell, skin);
    ear.scale.set(s * size, size, size);
    ear.position.copy(at).add(new Vector3(s * 0.03, 0, 0));
    ear.rotation.y = s * -0.45;
    inked(ear, 0.1);
    frame.add(ear);
  }
  // The lids: the skin a shade deeper, as it is where it folds, and no gold rim (which would ring each eye).
  const lid = toon(tone, {
    color: new Color(look.skin).multiplyScalar(0.86),
    rim: 0,
    soft: true,
  });
  const iris = irisTexture(look.name.length * 7);
  const feminine = look.skirt || look.hair === "puffs";
  const eyes: Eye[] = ([1, -1] as const).map((side) => {
    const socket = shape.eye(side);
    const eye = buildEye({
      flick: feminine,
      iris,
      lid,
      side,
      size: shape.layout.eye,
    });
    eye.root.position.copy(socket.centre);
    eye.root.quaternion.setFromUnitVectors(
      new Vector3(0, 0, 1),
      socket.forward,
    );
    frame.add(eye.root);
    return eye;
  });
  let expression: Expression = "calm";
  let lift = 0;
  return {
    blink(closed) {
      const shut = Math.min(1, Math.max(0, closed));
      const [upper, lower] = lidsFor[expression];
      for (const eye of eyes) eye.lids(upper + (0.3 - upper) * shut, lower);
    },
    brows(value) {
      lift = value;
    },
    look(yaw, pitch) {
      for (const eye of eyes) eye.look(yaw, pitch);
    },
    show(next) {
      expression = next;
      portrait.paint(next, lift);
    },
  };
}
