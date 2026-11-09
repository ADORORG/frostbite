import {
  Color,
  DoubleSide,
  Mesh,
  type MeshToonMaterial,
  SphereGeometry,
  type SkinnedMesh,
  type Texture,
  TorusGeometry,
  Vector3,
} from "three";

import { sigils, type Tone } from "../palette.ts";
import { inkedSkin, toon } from "../toon.ts";
import { skinned } from "./flesh.ts";
import { type Ring, SkinBuilder } from "./loft.ts";
import { smooth } from "./profile.ts";
import type { Look } from "./looks.ts";
import { starCloth, trimCloth } from "./patterns.ts";
import { type Rig, sides } from "./rig.ts";
import { armRings, legRings, torsoRings } from "./rings.ts";
import { taperedTube } from "./tube.ts";

// Clothes laid over the body, a little larger than it, bound to the same bones and inked like it: Kai's star-and-moon pyjamas with
// their collar and buttons, Zora's lavender hoodie, Daddy's grey henley and olive trousers, Mama's teal top and wrap skirt with their
// gold trim, and (once woven) the maridium jackets, with gold sigils sewn in.
export interface Clothes {
  readonly jacket: SkinnedMesh;
  readonly meshes: readonly SkinnedMesh[];
}

const fabric = (
  tone: Tone,
  colour: string,
  map: Texture | null = null,
): MeshToonMaterial => {
  const material = toon(tone, {
    color: map === null ? colour : "#ffffff",
    map,
    rim: 0.18,
  });
  material.side = DoubleSide;
  return material;
};

// A wrap skirt flaring from the waist to below the knee, swinging with the hips and the legs.
function skirt(rig: Rig): Ring[] {
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
      rx: b.hip * (1.16 + flare * 0.75),
      rz: b.hip * (0.92 + flare * 0.7),
    });
  }
  return rings;
}

// Small sewn things that ride the chest: a hood rolled at the back of the neck and its drawstrings, a collar, buttons.
function trims(rig: Rig, look: Look, tone: Tone): void {
  const b = rig.build;
  const chest = rig.joint("chest");
  const cloth = fabric(tone, look.top);
  const button = toon(tone, {
    color: look.stars ? "#f3e6c8" : "#3a3a36",
    rim: 0.1,
  });
  const buttons = (count: number, from: number) => {
    for (let at = 0; at < count; at += 1) {
      const dot = new Mesh(new SphereGeometry(b.limb * 0.16, 8, 6), button);
      dot.position.set(0, from - at * b.torso * 0.09, b.shoulder * 0.62);
      chest.add(dot);
    }
  };
  if (look.hair === "puffs") {
    const hood = new Mesh(new SphereGeometry(1, 20, 12), cloth);
    hood.scale.set(b.shoulder * 0.78, b.torso * 0.13, b.shoulder * 0.34);
    hood.position.set(0, b.torso * 0.24, -b.shoulder * 0.48);
    chest.add(hood);
    for (const s of [1, -1]) {
      const cord = new Mesh(
        taperedTube(
          [
            new Vector3(s * b.limb * 0.6, b.torso * 0.22, b.shoulder * 0.58),
            new Vector3(s * b.limb * 0.7, b.torso * 0.02, b.shoulder * 0.66),
          ],
          { radius: () => b.limb * 0.07, sides: 5 },
        ),
        toon(tone, { color: "#f2eefa", rim: 0.1 }),
      );
      chest.add(cord);
    }
  } else if (look.stars) {
    const collar = new Mesh(
      new TorusGeometry(b.limb * 2.05, b.limb * 0.5, 6, 28),
      fabric(tone, "#2b3f7a"),
    );
    collar.scale.set(1, 1, 0.35);
    collar.rotation.x = Math.PI / 2 - 0.3;
    collar.position.set(0, b.torso * 0.245, b.shoulder * 0.04);
    chest.add(collar);
    buttons(3, b.torso * 0.12);
  } else if (!look.skirt) buttons(2, b.torso * 0.2);
}

export function buildClothes(rig: Rig, look: Look, tone: Tone): Clothes {
  const pattern = look.stars ? starCloth(look.top, "#f6c24a", 5) : null;
  const meshes: SkinnedMesh[] = [];
  const ink = look.build.torso < 0.5 ? 0.003 : 0.0035;
  const wear = (
    builder: SkinBuilder,
    material: MeshToonMaterial,
  ): SkinnedMesh => {
    const mesh = skinned(builder, rig, material);
    mesh.add(inkedSkin(mesh.geometry, rig.skeleton, ink));
    meshes.push(mesh);
    return mesh;
  };
  if (look.skirt) {
    const top = new SkinBuilder();
    top.sweep(torsoRings(rig, look, { from: 0.6, grow: 1.06, to: 0.84 }), 28, {
      end: false,
      start: false,
    });
    wear(
      top,
      fabric(
        tone,
        look.top,
        trimCloth(
          look.top,
          "#f0b94a",
          [
            [0, 0.12],
            [0.88, 1],
          ],
          7,
        ),
      ),
    );
    const wrap = new SkinBuilder();
    wrap.sweep(skirt(rig), 32, { end: false, start: false }, 1);
    wear(
      wrap,
      fabric(
        tone,
        look.bottom,
        trimCloth(
          look.bottom,
          "#f0b94a",
          [
            [0, 0.05],
            [0.8, 0.94],
          ],
          9,
        ),
      ),
    );
  } else {
    const shirt = new SkinBuilder();
    shirt.sweep(
      torsoRings(rig, look, { from: 0.12, grow: 1.07, to: 0.975 }),
      28,
      { end: false, start: false },
      3,
    );
    for (const side of sides)
      shirt.sweep(
        armRings(rig, look, side, { from: 0, grow: 1.12, to: 0.9 }),
        18,
        { end: false, start: true },
        3,
      );
    wear(shirt, fabric(tone, look.top, pattern));
    const pants = new SkinBuilder();
    pants.sweep(
      torsoRings(rig, look, { from: 0, grow: 1.05, to: 0.36 }),
      28,
      { end: false, start: true },
      2,
    );
    for (const side of sides)
      pants.sweep(
        legRings(rig, look, side, { from: 0, grow: 1.1, to: 0.9 }),
        18,
        { end: false, start: false },
        4,
      );
    wear(pants, fabric(tone, look.bottom, pattern));
  }
  trims(rig, look, tone);
  const coat = new SkinBuilder();
  coat.sweep(
    torsoRings(rig, look, { from: 0.14, grow: 1.16, to: 0.975 }),
    28,
    { end: false, start: false },
    1,
  );
  for (const side of sides)
    coat.sweep(
      armRings(rig, look, side, { from: 0, grow: 1.2, to: 0.84 }),
      18,
      { end: false, start: true },
      2,
    );
  const jacketCloth = fabric(tone, look.jacket);
  jacketCloth.emissive = new Color("#ffbf47");
  jacketCloth.emissiveMap = sigils(31, 2.4);
  jacketCloth.emissiveIntensity = 1.1;
  const jacket = wear(coat, jacketCloth);
  jacket.visible = false;
  return { jacket, meshes };
}
