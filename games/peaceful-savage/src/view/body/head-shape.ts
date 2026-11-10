import { Vector3 } from "three";

// A human head, in units of its own size, facing +z with its middle between the ears. It is built as a sculptor builds one: a skull,
// then the masses of the face laid on it (the cheeks, the angle of the jaw, the chin, the arch of the mouth), then the features modelled
// on those (the brow, the cheekbones, a nose with its wings, the lips), with the sockets the eyes sit in. Each part is a soft solid and
// they are melted into each other, so the head is one smooth form: a grown face long, with a jaw and a chin; a child's round and full
// in the cheek, but with a chin of its own.
export interface HeadShape {
  // How full the cheeks are (0 lean, 1 a small child's).
  readonly cheeks: number;
  // How far below the eyes the bottom of the chin falls.
  readonly chin: number;
  // How wide the jaw is at its angle (0 narrow, 1 square).
  readonly jaw: number;
  // How pointed the chin is (0 broad, 1 pointed).
  readonly point: number;
  // Half the width of the skull.
  readonly wide: number;
  // How young (0 grown, 1 small child): a smaller nose, bigger eyes set lower.
  readonly young: number;
}

// Where the face's features fall, in the head's own units.
export interface Layout {
  readonly apart: number;
  readonly brow: number;
  readonly chin: number;
  readonly eye: number;
  readonly eyes: number;
  readonly mouth: number;
  readonly mouthWide: number;
  readonly nose: number;
}

export function layoutOf(shape: HeadShape): Layout {
  const eyes = -0.02 - shape.young * 0.07;
  return {
    apart: 0.355 + shape.young * 0.02,
    brow: eyes + 0.27,
    chin: eyes - shape.chin,
    eye: 0.188 + shape.young * 0.055,
    eyes,
    mouth: eyes - shape.chin * 0.58,
    mouthWide: 0.16 - shape.young * 0.025,
    nose: eyes - shape.chin * 0.37,
  };
}

type Point = { readonly x: number; readonly y: number; readonly z: number };

const ellipsoid = (p: Point, c: Point, r: Point): number => {
  const x = (p.x - c.x) / r.x;
  const y = (p.y - c.y) / r.y;
  const z = (p.z - c.z) / r.z;
  const k0 = Math.hypot(x, y, z);
  const k1 = Math.hypot(x / r.x, y / r.y, z / r.z);
  return k1 === 0 ? -Math.min(r.x, r.y, r.z) : (k0 * (k0 - 1)) / k1;
};
const ball = (p: Point, c: Point, radius: number): number =>
  Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) - radius;
const rod = (p: Point, a: Point, b: Point, radius: number): number => {
  const ab = new Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
  const ap = new Vector3(p.x - a.x, p.y - a.y, p.z - a.z);
  const h = Math.min(1, Math.max(0, ap.dot(ab) / ab.lengthSq()));
  return ap.sub(ab.multiplyScalar(h)).length() - radius;
};
// Two solids melted together over a seam k wide, and one carved softly out of another.
const melt = (a: number, b: number, k: number): number => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const carve = (a: number, b: number, k: number): number => -melt(-a, b, k);
const v = (x: number, y: number, z: number): Point => ({ x, y, z });

export interface Head {
  readonly layout: Layout;
  readonly skull: { readonly centre: Vector3; readonly radii: Vector3 };
  // How far a point is outside the head (negative inside).
  distance(p: Point, plain?: boolean): number;
  // Where the head's skin is in direction d from its middle; `plain` leaves out the hollows (the sockets, the lips, the nose's wings),
  // for the ink line round the head, which would show through a hollow.
  surface(d: Vector3, out?: Vector3, plain?: boolean): Vector3;
  // Where an eye sits (the centre of the eyeball, sunk so most of its front shows) and which way it looks.
  eye(side: 1 | -1): { centre: Vector3; forward: Vector3 };
  // Where an ear is set on the side of the head, and its size.
  ear(side: 1 | -1): { at: Vector3; size: number };
}

// The middle that the skin is found from: low and forward, so the long face is reached as evenly as the skull.
const middle = new Vector3(0, -0.25, 0.08);

export function headOf(shape: HeadShape): Head {
  const L = layoutOf(shape);
  const young = shape.young;
  const centre = new Vector3(0, 0.22 - young * 0.04, -0.08);
  const radii = new Vector3(shape.wide, 0.95 + young * 0.06, 1.08);
  const jawOut = 0.5 + shape.jaw * 0.16 + young * 0.04;
  const masses = (p: Point): number => {
    const q = v(Math.abs(p.x), p.y, p.z);
    let d = ellipsoid(q, centre, radii);
    const full = shape.cheeks;
    d = melt(
      d,
      ellipsoid(
        q,
        v(0.3 + full * 0.08, L.nose + 0.06, 0.28 + full * 0.06),
        v(0.34 + full * 0.08, 0.4, 0.5),
      ),
      0.3,
    );
    d = melt(d, ball(q, v(jawOut - 0.2, L.mouth - 0.13, -0.1), 0.2), 0.32);
    d = melt(
      d,
      ellipsoid(
        q,
        v(0, L.chin + 0.19, 0.56 - young * 0.07),
        v(0.27 - shape.point * 0.1, 0.19, 0.21),
      ),
      0.34,
    );
    return melt(
      d,
      ellipsoid(q, v(0, L.mouth + 0.03, 0.38), v(0.4, 0.36, 0.5)),
      0.24,
    );
  };
  // How far forward the face's masses come at (x, y): the front of the skin there before the features are modelled on.
  const front = (x: number, y: number): number => {
    let inside = 0;
    let outside = 1.6;
    if (masses(v(x, y, inside)) > 0) return 0;
    for (let step = 0; step < 28; step += 1) {
      const mid = (inside + outside) / 2;
      if (masses(v(x, y, mid)) < 0) inside = mid;
      else outside = mid;
    }
    return inside;
  };
  const browAt = v(0, L.brow, front(0, L.brow) - 0.07);
  const cheekAt = v(0.4, L.eyes - 0.2, front(0.4, L.eyes - 0.2) - 0.07);
  const bridge = v(0, L.eyes + 0.06, front(0, L.eyes + 0.06) - 0.03);
  const tip = v(
    0,
    L.nose + 0.07,
    front(0, L.nose + 0.07) + 0.17 - young * 0.07,
  );
  const wing = v(0.1 - young * 0.015, L.nose + 0.04, tip.z - 0.11);
  const lips = front(0, L.mouth);
  const eyeAt = (side: 1 | -1): Vector3 =>
    new Vector3(side * L.apart, L.eyes, front(L.apart, L.eyes) - L.eye * 0.78);
  const sockets = [eyeAt(1), eyeAt(-1)];
  const distance = (p: Point, plain = false): number => {
    const q = v(Math.abs(p.x), p.y, p.z);
    let d = masses(p);
    d = melt(d, ellipsoid(q, browAt, v(0.5, 0.085, 0.12 - young * 0.05)), 0.12);
    d = melt(d, ellipsoid(q, cheekAt, v(0.2, 0.11, 0.1)), 0.1);
    d = melt(d, rod(p, bridge, tip, 0.05 - young * 0.01), 0.07);
    d = melt(d, ball(p, tip, 0.095 - young * 0.02), 0.05);
    if (plain) return d;
    d = melt(d, ball(q, wing, 0.078 - young * 0.016), 0.05);
    d = melt(
      d,
      ellipsoid(q, v(0, L.mouth + 0.04, lips), v(L.mouthWide, 0.045, 0.06)),
      0.05,
    );
    d = melt(
      d,
      ellipsoid(
        q,
        v(0, L.mouth - 0.045, lips - 0.01),
        v(L.mouthWide * 0.82, 0.055, 0.065),
      ),
      0.05,
    );
    for (const socket of sockets)
      d = carve(d, ball(p, socket, L.eye * 1.1), 0.07);
    return d;
  };
  const surface = (d: Vector3, out = new Vector3(), plain = false): Vector3 => {
    let inside = 0;
    let outside = 2.6;
    const at = new Vector3();
    for (let step = 0; step < 30; step += 1) {
      const mid = (inside + outside) / 2;
      at.copy(middle).addScaledVector(d, mid);
      if (distance(at, plain) < 0) inside = mid;
      else outside = mid;
    }
    return out.copy(middle).addScaledVector(d, inside);
  };
  return {
    distance,
    ear(side) {
      const y = (L.eyes + L.nose) / 2 + 0.03;
      let x = 0;
      for (let step = 0.4; step < 1.4; step += 0.01) {
        if (masses(v(step, y, -0.12)) > 0) break;
        x = step;
      }
      return { at: new Vector3(side * x, y, -0.12), size: 0.29 - young * 0.02 };
    },
    eye(side) {
      return {
        centre: sockets[side > 0 ? 0 : 1]?.clone() ?? eyeAt(side),
        forward: new Vector3(side * 0.1, 0, 1).normalize(),
      };
    },
    layout: L,
    skull: { centre, radii },
    surface,
  };
}
