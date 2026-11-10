import { Matrix4, type Material, SkinnedMesh, Vector3 } from "three";

import { type Ring, SkinBuilder } from "./loft.ts";
import { chain } from "./profile.ts";
import type { Look } from "./looks.ts";
import { applyPose, fingerNames, type Rig, type Side, sides } from "./rig.ts";
import { armRings, legRings, neckRings, torsoRings } from "./rings.ts";

// Skin grown over the skeleton and bound to it: the bare parts of a body (neck and hands always; arms, torso and legs where the clothes
// leave them bare), a palm and fingers of three bones each. Clothes and shoes are grown the same way, a little larger, on the same
// bones, so cloth and body move as one.

function hand(
  builder: SkinBuilder,
  rig: Rig,
  side: Side,
  chubby: number,
): void {
  const b = rig.build;
  const joint = (name: string) => rig.joint(`${name}${side}`);
  const at = (name: string) => joint(name).getWorldPosition(new Vector3());
  const wrist = at("wrist");
  // Finger joints are named finger, side, part: "middleL1".
  const digit = (finger: string, part: number) =>
    rig.joint(`${finger}${side}${String(part)}`);
  const knuckle = digit("middle", 1).getWorldPosition(new Vector3());
  const wristBone = rig.boneIndex(`wrist${side}`);
  const palm: Ring[] = [0, 0.35, 0.7, 1].map((t) => ({
    bones: [[wristBone, 1]],
    centre: wrist.clone().lerp(knuckle, t),
    round: 2.6,
    rx: b.hand * (0.1 + Math.sin(t * Math.PI) * 0.04),
    rz: b.hand * (0.19 + t * 0.08),
  }));
  builder.sweep(palm, 14, { end: true, start: true });
  for (const finger of fingerNames) {
    const base = digit(finger, 1).getWorldPosition(new Vector3());
    const tip = digit(finger, 3).localToWorld(
      new Vector3(0, -b.hand * (finger === "thumb" ? 0.11 : 0.12), 0),
    );
    const points = [
      base,
      digit(finger, 2).getWorldPosition(new Vector3()),
      digit(finger, 3).getWorldPosition(new Vector3()),
      tip,
    ];
    const bones = [1, 2, 3].map((part) =>
      rig.boneIndex(`${finger}${side}${String(part)}`),
    );
    const thick =
      b.hand *
      chubby *
      (finger === "thumb" ? 0.068 : finger === "pinky" ? 0.048 : 0.056);
    builder.sweep(
      chain(
        points,
        bones,
        3,
        (t) => thick * (1 - t * 0.22),
        (t) => thick * (0.92 - t * 0.2),
        0.01,
      ),
      10,
      { end: true, start: true },
    );
  }
}

// One skinned mesh from a builder, bound to the rig as it stands at rest.
export function skinned(
  builder: SkinBuilder,
  rig: Rig,
  material: Material,
): SkinnedMesh {
  const mesh = new SkinnedMesh(builder.geometry(), material);
  mesh.bind(rig.skeleton, new Matrix4());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// Puts the rig at rest at the origin, so the body can be grown on it and bound to it.
export function atRest(rig: Rig): void {
  rig.root.position.set(0, 0, 0);
  rig.root.rotation.set(0, 0, 0);
  applyPose(rig, {});
  rig.root.updateMatrixWorld(true);
  rig.skeleton.calculateInverses();
}

// The bare skin of a body: neck and hands always; arms, torso and legs where the clothes leave them bare. Bare arms that carry
// markings (Mama's) are grown apart, so their gold can light on its own.
export interface Skin {
  readonly marked: SkinBuilder | null;
  readonly plain: SkinBuilder;
}

export function skinOf(rig: Rig, look: Look): Skin {
  const plain = new SkinBuilder();
  const marked =
    look.marks && look.sleeves === "none" ? new SkinBuilder() : null;
  plain.sweep(neckRings(rig, look), 20, { end: false, start: false }, 1);
  for (const side of sides) {
    hand(plain, rig, side, look.build.torso < 0.5 ? 1.15 : 1);
    (marked ?? plain).sweep(
      armRings(rig, look, side, {
        from: look.sleeves === "none" ? 0 : 0.84,
        grow: 1,
        to: 1,
      }),
      18,
      { end: false, start: true },
      2,
    );
    plain.sweep(
      legRings(rig, look, side, {
        from: look.skirt ? 0.3 : 0.86,
        grow: 1,
        to: 1,
      }),
      18,
      { end: false, start: true },
      2,
    );
  }
  if (look.skirt)
    plain.sweep(
      torsoRings(rig, look, { from: 0.25, grow: 1, to: 1 }),
      28,
      { end: false, start: true },
      1.5,
    );
  return { marked, plain };
}
