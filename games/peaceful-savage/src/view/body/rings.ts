import { Vector3 } from "three";

import type { Ring } from "./loft.ts";
import { chain, profile, smooth } from "./profile.ts";
import type { Look } from "./looks.ts";
import type { Rig, Side } from "./rig.ts";

// The shapes of a body at rest, as rings to grow skin or cloth through. A torso has hips, a waist, a ribcage and a chest, and slopes from
// the armpits over the shoulders to the neck; an arm has a round shoulder, an upper arm, a soft elbow and a forearm narrowing to the
// wrist; a leg a full thigh, a knee and a calf. Children are softer and rounder: a little tummy, no waist, chubbier arms and legs.
type Shape = "child" | "man" | "woman";

const shapeOf = (look: Look): Shape =>
  look.build.torso < 0.5 ? "child" : look.skirt ? "woman" : "man";

// Which part of a shape to grow (0 to 1 along it) and how much larger than the body (clothes are a little larger).
export interface Span {
  readonly from: number;
  readonly grow: number;
  readonly to: number;
}

type Keys = readonly (readonly [number, number])[];

const within = (rings: Ring[], span: Span): Ring[] =>
  rings.filter((_, index) => {
    const t = index / Math.max(1, rings.length - 1);
    return t >= span.from && t <= span.to;
  });

export function torsoRings(rig: Rig, look: Look, span: Span): Ring[] {
  const b = rig.build;
  const at = (name: string) => rig.joint(name).getWorldPosition(new Vector3());
  const pelvis = at("pelvis");
  const crotch = pelvis.clone().setY(pelvis.y - b.hip * 0.9);
  const shape = shapeOf(look);
  const neck = b.limb * 1.5;
  const sh = b.shoulder;
  // Landmarks along the torso: crotch 0, widest hip 0.13, waist 0.42, ribs 0.57, chest 0.72, armpit 0.86, shoulder line 0.95, neck 1.
  // Over the armpits the torso is the shoulders themselves, out to where the arms hang from; from there it slopes up to the neck.
  const top: Keys = [
    [0.93, sh * (shape === "woman" ? 0.88 : 0.93)],
    [0.955, sh * (shape === "woman" ? 0.8 : 0.85)],
    [0.978, sh * 0.6],
    [0.992, neck * 1.65],
    [1, neck * 1.3],
  ];
  const widths: Record<Shape, Keys> = {
    child: [
      [0, b.hip],
      [0.13, b.hip * 1.1],
      [0.42, b.hip * 1.02],
      [0.57, sh * 0.9],
      [0.72, sh * 0.93],
      [0.86, sh * 0.9],
      ...top,
    ],
    man: [
      [0, b.hip],
      [0.13, b.hip * 1.12],
      [0.42, b.hip * 0.98],
      [0.57, sh * 0.82],
      [0.72, sh * 0.88],
      [0.86, sh * 0.86],
      ...top,
    ],
    woman: [
      [0, b.hip * 1.05],
      [0.13, b.hip * 1.32],
      [0.42, b.hip * 0.8],
      [0.57, sh * 0.82],
      [0.72, sh * 0.86],
      [0.86, sh * 0.82],
      ...top,
    ],
  };
  const depths: Keys = [
    [0, b.hip * 0.75],
    [0.13, b.hip * 0.85],
    [0.42, b.hip * (shape === "child" ? 0.85 : 0.72)],
    [0.57, sh * (shape === "child" ? 0.7 : 0.62)],
    [0.72, sh * 0.6],
    [0.86, sh * 0.55],
    [0.95, sh * 0.47],
    [0.98, sh * 0.36],
    [1, neck * 1.1],
  ];
  const bust: Keys =
    shape === "woman"
      ? [
          [0.6, 0],
          [0.71, 0.28],
          [0.8, 0.04],
        ]
      : [[0, 0]];
  const points = [
    crotch,
    pelvis,
    at("spine"),
    at("spine2"),
    at("chest"),
    at("neck"),
  ];
  const bones = ["pelvis", "pelvis", "spine", "spine2", "chest"].map((name) =>
    rig.boneIndex(name),
  );
  const rings = chain(
    points,
    bones,
    8,
    (t) => profile(widths[shape], t) * span.grow,
    (t) => profile(depths, t) * span.grow,
    0.05,
    { round: 2.3 },
  ).map((ring, index, all) => ({
    ...ring,
    front: profile(bust, index / Math.max(1, all.length - 1)),
  }));
  return within(rings, span);
}

export function armRings(rig: Rig, look: Look, side: Side, span: Span): Ring[] {
  const b = rig.build;
  const at = (name: string) =>
    rig.joint(`${name}${side}`).getWorldPosition(new Vector3());
  const shoulder = at("shoulder");
  // The arm begins inside the shoulder, a little in from the joint and under it, so the round of it never stands above the shoulder's
  // own slope: a sleeve set into the body, not a ball on a doll.
  const cap = shoulder
    .clone()
    .add(new Vector3((side === "L" ? -1 : 1) * b.limb * 0.3, -b.limb * 0.5, 0));
  const L = b.limb * 1.1 * (shapeOf(look) === "child" ? 1.08 : 1);
  const widths: Keys = [
    [0, L * 1.02],
    [0.08, L * 1.1],
    [0.18, L * 1.06],
    [0.32, L],
    [0.48, L * 0.88],
    [0.55, L * 0.82],
    [0.64, L * 0.92],
    [0.86, L * 0.72],
    [1, L * 0.58],
  ];
  const points = [cap, at("elbow"), at("fore"), at("wrist")];
  const bones = ["shoulder", "elbow", "fore"].map((name) =>
    rig.boneIndex(`${name}${side}`),
  );
  const rings = chain(
    points,
    bones,
    5,
    (t) => profile(widths, t) * span.grow,
    (t) => profile(widths, t) * span.grow * 0.94,
    0.05,
  );
  return within(rings, span);
}

export function legRings(rig: Rig, look: Look, side: Side, span: Span): Ring[] {
  const b = rig.build;
  const at = (name: string) =>
    rig.joint(`${name}${side}`).getWorldPosition(new Vector3());
  const hip = at("hip");
  const top = hip.clone().add(new Vector3(0, b.limb * 1.4, 0));
  const L = b.limb * 1.62 * (shapeOf(look) === "child" ? 1.08 : 1);
  const widths: Keys = [
    [0, L * 0.95],
    [0.14, L],
    [0.42, L * 0.8],
    [0.52, L * 0.64],
    [0.62, L * 0.72],
    [0.8, L * 0.58],
    [1, L * 0.44],
  ];
  const points = [top, hip, at("knee"), at("ankle")];
  const bones = ["hip", "hip", "knee"].map((name) =>
    rig.boneIndex(`${name}${side}`),
  );
  const rings = chain(
    points,
    bones,
    5,
    (t) => profile(widths, t) * span.grow,
    (t) => profile(widths, t) * span.grow * 1.02,
    0.06,
  );
  return within(rings, span);
}

export function neckRings(rig: Rig, look: Look): Ring[] {
  const b = rig.build;
  const shape = shapeOf(look);
  const thick = shape === "man" ? 0.48 : shape === "woman" ? 0.4 : 0.4;
  const at = (name: string) => rig.joint(name).getWorldPosition(new Vector3());
  const head = at("head");
  const points = [
    at("neck").add(new Vector3(0, -b.limb, 0)),
    head,
    head.clone().add(new Vector3(0, b.head * 0.55, 0)),
  ];
  const keys = (bottom: number, middle: number, end: number): Keys => [
    [0, bottom],
    [0.5, middle],
    [1, end],
  ];
  return chain(
    points,
    [rig.boneIndex("neck"), rig.boneIndex("head")],
    4,
    (t) => profile(keys(b.limb * 1.75, b.limb * 1.4, b.head * thick), t),
    (t) =>
      profile(keys(b.limb * 1.6, b.limb * 1.3, b.head * (thick + 0.03)), t),
    0.03,
  );
}

// A wrap skirt flaring from the waist to below the knee, swinging with the hips and the legs.
export function skirtRings(rig: Rig): Ring[] {
  const b = rig.build;
  const pelvis = rig.joint("pelvis").getWorldPosition(new Vector3());
  const knee = rig.joint("kneeL").getWorldPosition(new Vector3());
  const rings: Ring[] = [];
  for (let step = 0; step <= 8; step += 1) {
    const t = step / 8;
    const y =
      pelvis.y +
      b.hip * 0.55 -
      t * (pelvis.y + b.hip * 0.55 - knee.y + b.shin * 0.3);
    const flare = smooth(0, 1, t);
    rings.push({
      bones: [
        [rig.boneIndex("pelvis"), 1 - flare * 0.5],
        [rig.boneIndex("hipL"), flare * 0.25],
        [rig.boneIndex("hipR"), flare * 0.25],
      ],
      centre: new Vector3(0, y, 0),
      rx: b.hip * (1.16 + flare * 0.8),
      rz: b.hip * (0.92 + flare * 0.95),
    });
  }
  return rings;
}
