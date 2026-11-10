import { Mesh, Object3D, SphereGeometry, Vector3 } from "three";

import type { Tone } from "../palette.ts";
import { toon } from "../toon.ts";
import { beads, headband } from "./adornments.ts";
import { beard } from "./beard.ts";
import { curls, stars } from "./coils.ts";
import { headOf } from "./head-shape.ts";
import { locs } from "./locs.ts";
import type { Look } from "./looks.ts";
import type { Rig } from "./rig.ts";

// Coily and kinky hair grows out, not down, and its outline is soft. So it is never a smooth cap: it is thousands of tight curls packed
// densest at the outer shell, so the silhouette reads as coils, over a dark core so no light shows through. A puff or an afro is a
// volume of them on a joint of its own that bounces as the body moves; under it, a dark cap and a close layer of short coils cover the
// whole scalp to a real hairline, so the hair always touches the head and no skin shows through. Galaxy hair (Mama's and Zora's) carries
// stars in it. Daddy's is freeform locs standing up like a crown, as on the cover, with his goatee and the close beard along his jaw.
export interface Hair {
  // The joints a bounce moves (a puff, an afro, the locs), each with where it rests.
  readonly springs: readonly {
    readonly joint: Object3D;
    readonly rest: Vector3;
  }[];
}

export function buildHair(
  rig: Rig,
  look: Look,
  tone: Tone,
  detail: number,
  amount: number,
): Hair {
  const head = rig.joint("head");
  const r = rig.build.head;
  const shape = headOf(look.face);
  const L = shape.layout;
  const skull = shape.skull;
  // From the head's own units (its middle, its own size) to the head joint's space, where the face is set.
  const place = (at: Vector3): Vector3 =>
    new Vector3(at.x * r, (at.y + 0.88) * r, at.z * r + 0.005);
  const material = toon(tone, { color: "#ffffff", rim: 0.32 });
  const core = toon(tone, {
    color: look.galaxy ? "#1b1240" : look.hairColour,
    rim: 0.1,
  });
  const springs: { joint: Object3D; rest: Vector3 }[] = [];
  const holder = (x: number, y: number, z: number): Object3D => {
    const joint = new Object3D();
    joint.position.copy(place(new Vector3(x, y, z)));
    head.add(joint);
    springs.push({ joint, rest: joint.position.clone() });
    return joint;
  };
  // The dark middle of a volume of curls, so the coils never show light through. Where hair may not grow (the face, the ears) the core
  // folds back inside the head.
  const fill = (
    parent: Object3D,
    radii: Vector3,
    inset: number,
    allow: (at: Vector3) => boolean,
  ) => {
    const geometry = new SphereGeometry(1, 28, 20);
    const position = geometry.getAttribute("position");
    const at = new Vector3();
    for (let index = 0; index < position.count; index += 1) {
      at.fromBufferAttribute(position, index)
        .multiply(radii)
        .multiplyScalar(inset);
      if (!allow(at.clone().add(parent.position))) at.multiplyScalar(0.2);
      position.setXYZ(index, at.x, at.y, at.z);
    }
    geometry.computeVertexNormals();
    parent.add(new Mesh(geometry, core));
  };
  const count = (n: number) => Math.max(40, Math.round(n * amount));
  // Where hair grows, for a point in the head joint's space: not on the face below the hairline, not at or in front of the ears, and
  // down the back of the head to the nape.
  const growsAt = (x: number, y: number, z: number): boolean => {
    const across = Math.abs(x);
    if (z > 0.15 && y < L.brow + 0.42 - across * 0.22) return false;
    if (across > 0.55 && y < L.eyes + 0.12 && z > -0.45) return false;
    return y > L.nose + 0.1 || (z < -0.2 && y > L.mouth);
  };
  const keep = (at: Vector3): boolean =>
    growsAt(at.x / r, at.y / r - 0.88, (at.z - 0.005) / r);
  const anywhere = () => true;
  // The close layer touches the scalp everywhere hair grows (the back and sides too, between and under puffs): a dark cap just over the
  // skin, so no skin shows between the coils, and the short coils packed on it.
  const scalp = holder(skull.centre.x, skull.centre.y, skull.centre.z);
  const close = skull.radii.clone().multiplyScalar(1.07 * r);
  fill(scalp, close, 0.95, keep);
  curls(
    scalp,
    { count: count(1500), keep, radii: close, size: r * 0.11 },
    material,
    look,
    3,
    detail,
  );
  if (look.hair === "coils") {
    const radii = new Vector3(r * 1.2, r * 1.3, r * 1.22);
    const top = holder(0, 0.3, -0.1);
    fill(top, radii, 0.86, keep);
    curls(
      top,
      { count: count(2600), keep, radii, size: r * 0.14 },
      material,
      look,
      5,
      detail,
    );
  } else if (look.hair === "puffs") {
    for (const s of [1, -1]) {
      const puff = holder(s * 0.84, 0.92, -0.12);
      const radii = new Vector3(r * 0.95, r * 0.88, r * 0.9);
      fill(puff, radii, 0.84, anywhere);
      curls(
        puff,
        { count: count(1800), keep: anywhere, radii, size: r * 0.13 },
        material,
        look,
        s > 0 ? 11 : 13,
        detail,
      );
      stars(
        puff,
        { count: Math.round(26 * amount) + 6, keep: anywhere, radii, size: 1 },
        s > 0 ? 17 : 19,
        false,
      );
      beads(puff, r, s);
    }
  } else if (look.hair === "locs") {
    const crown = holder(0, 0, 0);
    locs(
      crown,
      {
        centre: skull.centre,
        grows: (at) => growsAt(at.x, at.y, at.z),
        place: (at) => place(at).sub(crown.position),
        radii: skull.radii,
        size: r,
      },
      Math.max(28, Math.round(78 * Math.min(1, amount * 1.5))),
      toon(tone, { color: "#ffffff", rim: 0.3, vertexColors: true }),
      41,
    );
  } else {
    // Mama's galaxy afro, wide and high, with planets in it, and her headband with its feather.
    const crown = holder(0, 0.72, -0.62);
    const radii = new Vector3(r * 2.3, r * 1.95, r * 1.9);
    fill(crown, radii, 0.86, keep);
    curls(
      crown,
      { count: count(4600), keep, radii, size: r * 0.15 },
      material,
      look,
      23,
      detail,
    );
    stars(
      crown,
      { count: Math.round(60 * amount) + 10, keep, radii, size: 1 },
      29,
      true,
    );
    const band = L.brow + 0.33;
    const across = Math.sqrt(
      Math.max(0, 1 - ((band - skull.centre.y) / skull.radii.y) ** 2),
    );
    headband(head, r, {
      at: place(new Vector3(0, band, skull.centre.z)),
      deep: skull.radii.z * across * 1.05 * r,
      wide: skull.radii.x * across * 1.06 * r,
    });
  }
  if (look.beard)
    beard(
      head,
      shape,
      place,
      {
        colour: look.hairColour,
        count: count(420),
        detail,
        size: r * 0.06,
      },
      material,
    );
  return { springs };
}
