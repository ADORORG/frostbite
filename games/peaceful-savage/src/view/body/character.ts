import {
  AdditiveBlending,
  Color,
  MeshToonMaterial,
  Object3D,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";

import type { HeroId } from "../../rules/constants.ts";
import { softGlow, type Tone } from "../palette.ts";
import { inkedSkin, toon } from "../toon.ts";
import { earrings } from "./adornments.ts";
import { buildClothes } from "./clothes.ts";
import { buildFace } from "./face.ts";
import { atRest, skinned, skinOf } from "./flesh.ts";
import { buildHair } from "./hair.ts";
import { heightOf, type Look, looks } from "./looks.ts";
import { createMotion, type MotionInput } from "./motion.ts";
import { markings } from "./patterns.ts";
import { reach } from "./reach.ts";
import { buildRig } from "./rig.ts";

// One of the family, whole: a skeleton, one continuous skin grown over it and bound to its bones, clothes over that, a sculpted face,
// hair, earrings and the soft light of their spark around them.
export interface Character {
  readonly hero: HeroId;
  readonly height: number;
  // Where a hand is in the world (for the gold line-work a hand-key draws).
  hand(side: "L" | "R"): Vector3;
  // Where one of its joints is in the world (a shoulder, say), for another's hand to find.
  joint(name: string): Vector3;
  // Brings a hand to a point in the world after the pose, the elbow bending toward `pole` (see reach.ts).
  reach(side: "L" | "R", target: Vector3, pole: Vector3): void;
  // Puts the jacket on or takes it off, and how brightly its gold sigils shine (0 as woven, 1 lit up by the ancestors).
  dress(jacket: boolean, shine?: number): void;
  // How brightly their spark shows (0 to 1).
  glow(amount: number): void;
  place(x: number, z: number, heading: number): void;
  // Lifts the character off the ground by `offset` (the flight after the tree is lit; nothing, on the ground) and, flying, turns them
  // to the way they fly (`way`) and leans them into it.
  fly(offset: Vector3, way: number | null, lean: number): void;
  readonly root: Object3D;
  update(input: MotionInput): void;
}

export interface CharacterOptions {
  readonly detail: number;
  readonly hairAmount: number;
  readonly tone: Tone;
}

// Skin: painted in bands, warm at the edges where the gold light rakes it. Mama's marked arms carry gold that glows.
function skinMaterial(
  look: Look,
  tone: Tone,
  marked: boolean,
): MeshToonMaterial {
  const material = toon(tone, {
    color: look.skin,
    rim: 0.24,
    vertexColors: true,
  });
  if (marked) {
    material.emissive = new Color("#ffb53a");
    material.emissiveMap = markings();
    material.emissiveIntensity = 0.6;
  }
  return material;
}

export function buildCharacter(
  hero: HeroId,
  options: CharacterOptions,
): Character {
  const look = looks[hero];
  const rig = buildRig(look.build);
  atRest(rig);
  const skin = skinOf(rig, look);
  const meshes = [
    skinned(skin.plain, rig, skinMaterial(look, options.tone, false)),
  ];
  if (skin.marked !== null)
    meshes.push(
      skinned(skin.marked, rig, skinMaterial(look, options.tone, true)),
    );
  // The ink line round the bare skin, as round the clothes and the face.
  const ink = look.build.torso < 0.5 ? 0.003 : 0.0035;
  for (const mesh of meshes)
    mesh.add(inkedSkin(mesh.geometry, rig.skeleton, ink));
  const clothes = buildClothes(rig, look, options.tone);
  const face = buildFace(rig, look, options.tone);
  const hair = buildHair(
    rig,
    look,
    options.tone,
    options.detail,
    options.hairAmount,
  );
  earrings(rig.joint("head"), hero, look.build.head);
  const motion = createMotion(rig, face, hair, hero.length * 977);
  const root = new Object3D();
  root.name = hero;
  root.add(rig.root);
  // A skinned mesh follows its bones wherever it sits in the scene; it is kept beside the skeleton.
  for (const mesh of [...meshes, ...clothes.meshes]) root.add(mesh);
  // The spark's light: a soft glow at the heart, brighter as the spark is.
  const aura = new Sprite(
    new SpriteMaterial({
      blending: AdditiveBlending,
      color: "#ffc35a",
      depthWrite: false,
      map: softGlow(),
      opacity: 0.3,
      transparent: true,
    }),
  );
  aura.scale.setScalar(look.build.shoulder * 5);
  rig.joint("chest").add(aura);
  return {
    dress(jacket, shine = 0) {
      clothes.jacket.visible = jacket;
      const cloth = clothes.jacket.material;
      if (cloth instanceof MeshToonMaterial)
        cloth.emissiveIntensity = 1.1 + shine * 2.6;
    },
    glow(amount) {
      aura.material.opacity = Math.max(0, Math.min(1, amount)) * 0.35;
      aura.visible = amount > 0.02;
    },
    hand(side) {
      return rig.joint(`wrist${side}`).getWorldPosition(new Vector3());
    },
    height: heightOf(look.build),
    hero,
    joint(name) {
      return rig.joint(name).getWorldPosition(new Vector3());
    },
    reach(side, target, pole) {
      reach(
        rig.joint(`shoulder${side}`),
        rig.joint(`elbow${side}`),
        rig.joint(`wrist${side}`),
        target,
        pole,
      );
    },
    place(x, z, heading) {
      rig.root.position.set(x, rig.root.position.y, z);
      rig.root.rotation.y = heading;
    },
    fly(offset, way, lean) {
      root.position.copy(offset);
      if (way !== null) rig.root.rotation.y = way;
      // Turned first, then leant: forward along the way they face.
      rig.root.rotation.order = "YXZ";
      rig.root.rotation.x = lean;
    },
    root,
    update(input) {
      motion.update(input);
      rig.root.updateMatrixWorld(true);
    },
  };
}
