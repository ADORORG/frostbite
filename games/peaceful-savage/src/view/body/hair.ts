import { Mesh, Object3D, SphereGeometry, Vector3 } from "three";

import type { Tone } from "../palette.ts";
import { toon } from "../toon.ts";
import { beads, headband, pick } from "./adornments.ts";
import { curls, stars } from "./coils.ts";
import type { Look } from "./looks.ts";
import type { Rig } from "./rig.ts";

// Coily and kinky hair grows out, not down, and its outline is soft. So it is never a smooth cap: it is thousands of tight curls packed
// densest at the outer shell, so the silhouette reads as coils, over a dark core so no light shows through. A puff or an afro is a
// volume of them on a joint of its own that bounces as the body moves; under it, a dark cap and a close layer of short coils cover the
// whole scalp to a real hairline, so the hair always touches the head and no skin shows through. Galaxy hair (Mama's and Zora's) carries stars in it; Daddy's afro is deep brown-black with his gold pick in it.
export interface Hair {
  // The joints a bounce moves (a puff, an afro), each with where it rests.
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
  const material = toon(tone, { color: "#ffffff", rim: 0.32 });
  const core = toon(tone, {
    color: look.galaxy ? "#1b1240" : look.hairColour,
    rim: 0.1,
  });
  const springs: { joint: Object3D; rest: Vector3 }[] = [];
  const holder = (x: number, y: number, z: number): Object3D => {
    const joint = new Object3D();
    joint.position.set(x, y, z);
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
  // Bare below the hairline, at the ears and low at the nape.
  const keep = (at: Vector3): boolean => {
    const y = at.y / r;
    const z = at.z / r;
    const x = Math.abs(at.x / r);
    if (z > 0.15 && y < 1.62 - x * 0.25) return false;
    if (x > 0.8 && y < 1.15 && z > -0.5) return false;
    return y > 0.55 || z < -0.2;
  };
  const anywhere = () => true;
  // The close layer touches the scalp everywhere hair grows (the back and sides too, between and under puffs): a dark cap just over the
  // skin, so no skin shows between the coils, and the short coils packed on it.
  const scalp = holder(0, r * 0.98, -r * 0.04);
  const close = new Vector3(r * 1.06, r * 1.12, r * 1.08);
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
    const radii = new Vector3(r * 1.3, r * 1.36, r * 1.28);
    const top = holder(0, r * 1.1, -r * 0.06);
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
      const puff = holder(s * r * 0.86, r * 1.78, -r * 0.1);
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
  } else if (look.galaxy) {
    // Mama's galaxy afro, wide and high, with planets in it.
    const crown = holder(0, r * 1.55, -r * 0.4);
    const radii = new Vector3(r * 2.3, r * 1.95, r * 2.05);
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
    headband(head, r);
  } else {
    // Daddy's afro: round and full, a crisp hairline, his gold pick standing in it.
    const crown = holder(0, r * 1.5, -r * 0.22);
    const radii = new Vector3(r * 1.68, r * 1.52, r * 1.62);
    fill(crown, radii, 0.86, keep);
    curls(
      crown,
      { count: count(3800), keep, radii, size: r * 0.14 },
      material,
      look,
      41,
      detail,
    );
    pick(crown, r);
  }
  if (look.beard) {
    const beard = (at: Vector3) => at.z > r * 0.1 && at.y < r * 0.3;
    curls(
      rig.joint("jaw"),
      {
        count: count(320),
        keep: beard,
        radii: new Vector3(r * 0.56, r * 0.32, r * 0.52),
        size: r * 0.065,
      },
      material,
      look,
      37,
      detail,
    );
  }
  return { springs };
}
