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

import type { Tone } from "../palette.ts";
import { inkedSkin, toon } from "../toon.ts";
import { skinned } from "./flesh.ts";
import { SkinBuilder } from "./loft.ts";
import type { Look } from "./looks.ts";
import {
  jacketCloth,
  ribCloth,
  shoeCloth,
  starCloth,
  trimCloth,
} from "./patterns.ts";
import { type Rig, sides } from "./rig.ts";
import { armRings, legRings, skirtRings, torsoRings } from "./rings.ts";
import { shoeRings } from "./shoes.ts";
import { taperedTube } from "./tube.ts";

// Clothes laid over the body, a little larger than it, bound to the same bones and inked like it, each sewn as clothes are: a body and
// sleeves, ribbed cuffs and a hem, a waistband, trouser cuffs, shoes. Kai's star-and-moon pyjamas with their collar and buttons, Zora's
// lavender hoodie, Daddy's grey henley and olive trousers, Mama's teal top and wrap skirt with their gold trim; and, once woven, the
// maridium jackets: bold bands of triangles, chevrons and diamonds edged in gold line-work, hanging open over the shirt, with a ribbed
// collar, cuffs and waist.
export interface Clothes {
  // Puts the jacket on or takes it off, and how brightly its gold shines (0 as woven, 1 lit up by the ancestors).
  dress(jacket: boolean, shine: number): void;
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

const open = { end: false, start: false } as const;

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
  const ink = look.build.torso < 0.5 ? 0.0052 : 0.006;
  const wear = (
    builder: SkinBuilder,
    material: MeshToonMaterial,
  ): SkinnedMesh => {
    const mesh = skinned(builder, rig, material);
    mesh.add(inkedSkin(mesh.geometry, rig.skeleton, ink));
    meshes.push(mesh);
    return mesh;
  };
  // Bands of ribbed knit round the body, the arms or the legs, a little prouder than the cloth they finish.
  const ribbed = (
    colour: string,
    grow: number,
    parts: {
      readonly arms?: readonly [number, number];
      readonly legs?: readonly [number, number];
      readonly torso?: readonly (readonly [number, number])[];
    },
  ): SkinnedMesh => {
    const ribs = new SkinBuilder();
    for (const [from, to] of parts.torso ?? [])
      ribs.sweep(torsoRings(rig, look, { from, grow, to }), 28, open);
    for (const side of sides) {
      if (parts.arms !== undefined) {
        const [from, to] = parts.arms;
        ribs.sweep(armRings(rig, look, side, { from, grow, to }), 18, open);
      }
      if (parts.legs !== undefined) {
        const [from, to] = parts.legs;
        ribs.sweep(legRings(rig, look, side, { from, grow, to }), 18, open);
      }
    }
    return wear(ribs, fabric(tone, colour, ribCloth(colour, 71)));
  };
  const darker = (colour: string, by = 0.72): string =>
    `#${new Color(colour).multiplyScalar(by).getHexString()}`;
  if (look.skirt) {
    // Mama's top: cut short over the ribs and high to a gold collar, with a cap of cloth over each shoulder edged in gold.
    const top = new SkinBuilder();
    top.sweep(
      torsoRings(rig, look, { from: 0.6, grow: 1.06, to: 0.985 }),
      28,
      open,
    );
    const banded = (bands: readonly (readonly [number, number])[]) =>
      fabric(tone, look.top, trimCloth(look.top, "#f0b94a", bands, 7));
    wear(
      top,
      banded([
        [0, 0.09],
        [0.9, 1],
      ]),
    );
    const caps = new SkinBuilder();
    for (const side of sides)
      caps.sweep(
        armRings(rig, look, side, { from: 0, grow: 1.16, to: 0.21 }),
        18,
        { end: false, start: true },
      );
    wear(caps, banded([[0.62, 1]]));
    const wrap = new SkinBuilder();
    wrap.sweep(skirtRings(rig), 32, open, 1);
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
    // The picture on the cloth is laid as wide as it is long, so a star stays a star.
    shirt.sweep(
      torsoRings(rig, look, { from: 0.12, grow: 1.07, to: 0.975 }),
      28,
      open,
      0.6,
    );
    for (const side of sides)
      shirt.sweep(
        armRings(rig, look, side, { from: 0, grow: 1.12, to: 0.9 }),
        18,
        { end: false, start: true },
        1.9,
      );
    wear(shirt, fabric(tone, look.top, pattern));
    ribbed(darker(look.top), 1.18, {
      arms: [0.8, 0.9],
      torso: [
        [0.12, 0.17],
        [0.97, 1],
      ],
    });
    const pants = new SkinBuilder();
    pants.sweep(
      torsoRings(rig, look, { from: 0, grow: 1.05, to: 0.36 }),
      28,
      { end: false, start: true },
      0.3,
    );
    for (const side of sides)
      pants.sweep(
        legRings(rig, look, side, { from: 0, grow: 1.1, to: 0.9 }),
        18,
        open,
        2,
      );
    wear(pants, fabric(tone, look.bottom, pattern));
    ribbed(darker(look.bottom), 1.17, { legs: [0.8, 0.9] });
  }
  // Shoes: one last each, the heel on the ankle and the toe on the toes.
  const shoes = new SkinBuilder();
  for (const side of sides)
    shoes.sweep(shoeRings(rig, side, look.shoes.kind), 16, {
      end: true,
      start: true,
    });
  wear(shoes, fabric(tone, "#ffffff", shoeCloth(look.shoes, look.skin, 83)));
  trims(rig, look, tone);
  // The jacket: its body (open down the front, over the shirt), its sleeves, and its ribbed collar, cuffs and waist.
  const colours = { ground: look.jacket, inner: look.top, marks: look.marks3 };
  const lit: MeshToonMaterial[] = [];
  const woven = (builder: SkinBuilder, front: boolean): SkinnedMesh => {
    const cloth = jacketCloth(colours, front, front ? 31 : 37);
    const material = fabric(tone, "#ffffff", cloth.map);
    material.emissive = new Color("#ffbf47");
    material.emissiveMap = cloth.glow;
    lit.push(material);
    return wear(builder, material);
  };
  const body = new SkinBuilder();
  body.sweep(
    torsoRings(rig, look, { from: 0.14, grow: 1.16, to: 0.975 }),
    28,
    open,
    1,
  );
  const sleeves = new SkinBuilder();
  for (const side of sides)
    sleeves.sweep(
      armRings(rig, look, side, { from: 0, grow: 1.2, to: 0.84 }),
      18,
      { end: false, start: true },
      2,
    );
  const jacket = [
    woven(body, true),
    woven(sleeves, false),
    ribbed(darker(look.jacket, 0.5), 1.27, {
      arms: [0.74, 0.87],
      torso: [
        [0.14, 0.2],
        [0.955, 1],
      ],
    }),
  ];
  for (const piece of jacket) piece.visible = false;
  return {
    dress(on, shine) {
      for (const piece of jacket) piece.visible = on;
      for (const material of lit)
        material.emissiveIntensity = 0.35 + shine * 2.4;
    },
    meshes,
  };
}
