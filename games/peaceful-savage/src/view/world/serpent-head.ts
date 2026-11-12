import {
  BufferAttribute,
  BufferGeometry,
  type Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshToonMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

import { profile, smooth } from "../body/profile.ts";
import { taperedTube } from "../body/tube.ts";
import { inkMaterial } from "../toon.ts";

// The giant snake's head, designed in Blender and built here from the same numbers: a long wedge, widest at the hinge of the jaw and
// narrowing to a round snout, with a brow over each eye, a socket for the eye to sit in, nostrils, and one long mouth line turned down a
// little at the corners. Asleep its eyes are shut (a dark line of lashes, lower at the outer corner); awake the heavy lids lift halfway
// over sorrowful eyes. No fangs, nothing to fear: it is grief, not menace.
type Keys = readonly (readonly [number, number])[];

// The neck's radius, in metres: the head is measured in it.
export const neck = 0.64;
const long = 4.5;
const rows = 44;
const sides = 32;
const deg = Math.PI / 180;
const eye = 0.4 * neck;

const wide: Keys = [
  [0, 1],
  [0.12, 1.22],
  [0.32, 1.66],
  [0.5, 1.52],
  [0.72, 1.08],
  [0.88, 0.84],
  [0.95, 0.66],
  [0.985, 0.4],
  [1, 0.02],
];
const over: Keys = [
  [0, 0.98],
  [0.3, 1.08],
  [0.47, 1.1],
  [0.62, 0.86],
  [0.85, 0.6],
  [0.95, 0.46],
  [0.985, 0.3],
  [1, 0.02],
];
const under: Keys = [
  [0, 0.95],
  [0.3, 0.8],
  [0.6, 0.62],
  [0.9, 0.44],
  [0.985, 0.28],
  [1, 0.02],
];
const dip: Keys = [
  [0, 0],
  [0.5, 0],
  [1, -0.14],
];

// A soft rise at a place along the head (`t0`) and round it (`a0`), `wt` long and `wa` wide.
const bump = (
  t: number,
  a: number,
  [t0, a0, wt, wa]: readonly [number, number, number, number],
): number => Math.exp(-(((t - t0) / wt) ** 2) - ((a - a0) / wa) ** 2);

const brow = [0.57, 52 * deg, 0.13, 0.26] as const;
const socket = [0.55, 24 * deg, 0.07, 0.22] as const;
const cheek = [0.3, -12 * deg, 0.14, 0.4] as const;
const nostril = [0.93, 58 * deg, 0.035, 0.22] as const;

// A point on the head: `t` 0 at the neck to 1 at the snout, `a` round it (0 its right side, a quarter turn its top). The head looks
// along +z, and begins half a metre behind where the neck ends.
export function headPoint(t: number, a: number, out = new Vector3()): Vector3 {
  const power = 2 / (2.5 - 0.3 * t);
  const c = Math.cos(a);
  const s = Math.sin(a);
  let x = profile(wide, t) * Math.sign(c) * Math.abs(c) ** power;
  let y =
    profile(s >= 0 ? over : under, t) * Math.sign(s) * Math.abs(s) ** power;
  let push = 0;
  for (const mirrored of [a, Math.PI - a]) {
    const turn = Math.atan2(Math.sin(mirrored), Math.cos(mirrored));
    push +=
      0.26 * bump(t, turn, brow) -
      0.1 * bump(t, turn, socket) +
      0.08 * bump(t, turn, cheek) +
      0.06 * bump(t, turn, nostril);
  }
  const r = Math.hypot(x, y) || 1;
  x += (x / r) * push;
  y += (y / r) * push;
  return out.set(x * neck, (y + profile(dip, t)) * neck, t * long * neck - 0.5);
}

// Which of the skin's three tones a point of the head wears: 0 its ground, 1 the dark of the blaze down its crown and the line along
// its lip, 2 the pale of its throat.
function toneAt(t: number, a: number): number {
  const s = Math.sin(a);
  if (s < -0.3) return 2;
  if (s < -0.16) return 1;
  return Math.abs(Math.cos(a)) < 0.4 - t * 0.28 && s > 0 && t < 0.82 ? 1 : 0;
}

export interface Head {
  readonly made: Group;
  // How far awake (0 asleep to 1), and the head's three tones now (grey, or gold once healed).
  update(wake: number, tones: readonly Color[]): void;
}

export function buildHead(skin: MeshToonMaterial): Head {
  const made = new Group();
  const positions: number[] = [];
  const uvs: number[] = [];
  const tones: number[] = [];
  const indices: number[] = [];
  const at = new Vector3();
  for (let row = 0; row <= rows; row += 1)
    for (let side = 0; side < sides; side += 1) {
      const t = row / rows;
      const a = (side / sides) * Math.PI * 2;
      headPoint(t, a, at);
      positions.push(at.x, at.y, at.z);
      uvs.push(Math.abs((side / sides) * 2 - 1) * 2, t * 3);
      tones.push(toneAt(t, a));
    }
  for (let row = 0; row < rows; row += 1)
    for (let side = 0; side < sides; side += 1) {
      const a = row * sides + side;
      const b = row * sides + ((side + 1) % sides);
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
  const shape = new BufferGeometry();
  shape.setAttribute("position", new Float32BufferAttribute(positions, 3));
  shape.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  const shades = new BufferAttribute(new Float32Array(positions.length), 3);
  shape.setAttribute("color", shades);
  shape.setIndex(indices);
  shape.computeVertexNormals();
  const skull = new Mesh(shape, skin);
  skull.add(new Mesh(shape, inkMaterial(0.03)));
  made.add(skull);
  const ink = new MeshBasicMaterial({ color: "#191226" });
  const lidSkin = new MeshStandardMaterial({ roughness: 0.75 });
  const white = new MeshStandardMaterial({ color: "#f1ead8", roughness: 0.3 });
  const dark = new MeshStandardMaterial({ color: "#3b2b5c", roughness: 0.2 });
  const up = new Vector3(0, 1, 0);
  const ahead = new Vector3(0, 0, 1);
  const eyes = ([1, -1] as const).map((s) => {
    const out = new Vector3(s * 0.74, 0.4, 0.52).normalize();
    const centre = headPoint(0.55, s > 0 ? socket[1] : Math.PI - socket[1])
      .clone()
      .addScaledVector(out, -eye * 0.62);
    const ball = new Mesh(new SphereGeometry(eye, 20, 14), white);
    ball.position.copy(centre);
    const iris = new Mesh(new SphereGeometry(eye * 0.6, 14, 10), dark);
    iris.position.copy(centre).addScaledVector(out, eye * 0.52);
    iris.position.y -= eye * 0.16;
    // The lid: a cap of a slightly larger ball, turned down over the whole eye asleep and lifted halfway awake.
    const lid = new Mesh(
      new SphereGeometry(eye * 1.06, 20, 12, 0, Math.PI * 2, 0, 107 * deg),
      lidSkin,
    );
    lid.position.copy(centre);
    const shut = new Quaternion().setFromUnitVectors(
      up,
      out.clone().addScaledVector(up, 0.2).normalize(),
    );
    const lifted = new Quaternion().setFromUnitVectors(
      up,
      up
        .clone()
        .addScaledVector(out, 0.3)
        .addScaledVector(ahead, -0.3)
        .normalize(),
    );
    // The dark line of the lashes across the shut lid: a long arc, lower at the outer corner.
    const across = out.clone().cross(up).normalize();
    const tilt = across.dot(ahead) > 0 ? -1 : 1;
    const arc = Array.from({ length: 11 }, (_, index) => {
      const f = index / 10 - 0.5;
      return centre.clone().addScaledVector(
        across
          .clone()
          .multiplyScalar(f * 2)
          .addScaledVector(out, 0.95)
          .addScaledVector(up, -(0.42 + 2 * f * f + 0.22 * f * tilt))
          .normalize(),
        eye * 1.09,
      );
    });
    const lash = new Mesh(
      taperedTube(arc, { radius: () => 0.034, sides: 5 }),
      ink,
    );
    const pit = new Mesh(new SphereGeometry(0.07, 8, 6), ink);
    pit.position.copy(
      headPoint(0.93, s > 0 ? nostril[1] : Math.PI - nostril[1]),
    );
    pit.scale.set(1, 0.5, 1);
    made.add(ball, iris, lid, lash, pit);
    return { iris, lash, lid, lifted, shut };
  });
  // The mouth: one line from the hinge of the jaw on one side, round the snout, to the hinge on the other.
  const lip = (s: number, index: number): Vector3 => {
    const t = 0.985 - (index / 14) * 0.7;
    const turn =
      (-17 - 9 * smooth(0.55, 0.3, t) + 6 * smooth(0.9, 0.99, t)) * deg;
    const point = headPoint(t, s > 0 ? turn : Math.PI - turn).clone();
    const r = Math.hypot(point.x, point.y) || 1;
    point.x *= 1 + 0.012 / r;
    point.y *= 1 + 0.012 / r;
    return point;
  };
  const line = [
    ...Array.from({ length: 15 }, (_, index) => lip(1, 14 - index)),
    ...Array.from({ length: 15 }, (_, index) => lip(-1, index)),
  ];
  made.add(new Mesh(taperedTube(line, { radius: () => 0.024, sides: 5 }), ink));
  return {
    made,
    update(wake, palette) {
      const open = smooth(0.35, 0.9, wake);
      for (const each of eyes) {
        each.lid.quaternion.copy(each.shut).slerp(each.lifted, open);
        each.iris.visible = open > 0.2;
        each.lash.visible = open < 0.5;
      }
      const ground = palette[0];
      if (ground === undefined || lidSkin.color.equals(ground)) return;
      lidSkin.color.copy(ground);
      tones.forEach((tone, index) => {
        const shade = palette[tone] ?? ground;
        shades.setXYZ(index, shade.r, shade.g, shade.b);
      });
      shades.needsUpdate = true;
    },
  };
}
