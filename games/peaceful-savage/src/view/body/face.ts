import { Mesh, Object3D, Vector3 } from "three";

import type { Tone } from "../palette.ts";
import { inked, toon } from "../toon.ts";
import { buildEye, type Eye, irisTexture } from "./eyes.ts";
import {
  earGeometry,
  type Expression,
  eyeSize,
  eyeSocket,
  headGeometry,
  type HeadShape,
} from "./head.ts";
import type { Look } from "./looks.ts";
import { buildPortrait } from "./portrait.ts";
import type { Rig } from "./rig.ts";

// The face: a sculpted head with its features painted on (brows, nose shadow, lips and the mouth of each feeling), real eyes set in it
// that look at what the head turns to and blink, and ears. Inked round like the body.
export type { Expression } from "./head.ts";

export interface Face {
  blink(closed: number): void;
  brows(lift: number): void;
  look(yaw: number, pitch: number): void;
  show(expression: Expression): void;
}

// How open the upper lid sits for each feeling, and where the lower lid rests (smiles lift it).
const lidsFor: Readonly<Record<Expression, readonly [number, number]>> = {
  calm: [-0.42, 0.74],
  open: [-0.85, 0.8],
  smile: [-0.5, 0.5],
  smirk: [-0.48, 0.62],
  worry: [-0.62, 0.72],
};

export function buildFace(rig: Rig, look: Look, tone: Tone): Face {
  const r = rig.build.head;
  const young = rig.build.torso < 0.5 ? (rig.build.torso < 0.4 ? 1 : 0.7) : 0;
  const shape: HeadShape = { jaw: look.beard ? 1 : 0.3, young };
  const portrait = buildPortrait(look, young, look.name.length * 131);
  const skin = toon(tone, { color: look.skin, rim: 0.22 });
  const head = new Mesh(
    headGeometry(shape),
    toon(tone, { color: "#ffffff", map: portrait.texture, rim: 0.22 }),
  );
  head.castShadow = true;
  inked(head, 0.028);
  const frame = new Object3D();
  frame.position.set(0, r * 0.88, 0.005);
  frame.scale.setScalar(r);
  rig.joint("head").add(frame);
  frame.add(head);
  for (const s of [1, -1]) {
    const ear = new Mesh(earGeometry(), skin);
    ear.scale.setScalar(0.21);
    ear.position.set(s * 0.98, -0.06, -0.08);
    ear.rotation.y = s * -0.2;
    inked(ear, 0.12);
    frame.add(ear);
  }
  const iris = irisTexture(look.name.length * 7);
  const feminine = look.skirt || look.hair === "puffs";
  const eyes: Eye[] = ([1, -1] as const).map((side) => {
    const socket = eyeSocket(shape, side);
    const eye = buildEye({
      flick: feminine,
      iris,
      lid: skin,
      side,
      size: eyeSize(young),
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
