import {
  type BufferGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

// A head, in units of its own radius, facing +z: a round skull, a jaw that narrows to the chin, full cheeks (fuller on the children), soft
// eye sockets for the eyes to sit in, a brow, and a nose. The rest of the face (brows, lips, the moods of the mouth) is painted onto it,
// so every vertex carries where it falls on the painted face: a picture of the face seen from the front.
export type Expression = "calm" | "open" | "smile" | "smirk" | "worry";
export const expressions: readonly Expression[] = [
  "calm",
  "open",
  "smile",
  "smirk",
  "worry",
];

export interface HeadShape {
  // How square the jaw is (0 soft, 1 strong).
  readonly jaw: number;
  // How young (0 grown, 1 small child): bigger cheeks, a smaller nose, eyes set lower.
  readonly young: number;
}

// The painted face covers the front of the head: a point at (x, y) on the unit sphere is drawn at (0.5 + x * k, 0.5 + (y - c) * k).
export const faceScale = 0.55;
export const faceCentre = -0.05;
export const eyeLine = (young: number): number => -0.02 - young * 0.06;
export const eyeApart = 0.34;
export const eyeSize = (young: number): number => 0.2 + young * 0.035;

const ease = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// A soft rise on the front of the face, centred at (x, y), wx wide and wy tall.
function rise(
  d: Vector3,
  x: number,
  y: number,
  wx: number,
  wy: number,
): number {
  const dx = (d.x - x) / wx;
  const dy = (d.y - y) / wy;
  return Math.exp(-(dx * dx + dy * dy)) * ease(0.05, 0.4, d.z);
}

const both = (
  d: Vector3,
  x: number,
  y: number,
  wx: number,
  wy: number,
): number => rise(d, x, y, wx, wy) + rise(d, -x, y, wx, wy);

// Where a direction from the head's centre meets the head's surface.
export function sculpt(
  shape: HeadShape,
  d: Vector3,
  out = new Vector3(),
): Vector3 {
  const young = shape.young;
  const eyes = eyeLine(young);
  const lift =
    1 +
    0.04 * (1 - young * 0.6) * both(d, 0.32, eyes + 0.27, 0.2, 0.07) -
    0.06 * both(d, eyeApart, eyes, 0.15, 0.12) +
    (0.05 - young * 0.03) * rise(d, 0, eyes + 0.02, 0.06, 0.16) +
    (0.14 - young * 0.035) * rise(d, 0, eyes - 0.27, 0.085, 0.075) +
    (0.07 - young * 0.015) * both(d, 0.1, eyes - 0.31, 0.065, 0.06) +
    0.045 * rise(d, 0, eyes - 0.5, 0.3, 0.17) +
    (0.04 + young * 0.03) * both(d, 0.4, eyes - 0.32, 0.2, 0.2) +
    0.035 * (1 - young * 0.5) * rise(d, 0, eyes - 0.76, 0.16, 0.09);
  out.copy(d).multiplyScalar(lift);
  out.y *= 1.08;
  out.z *= 1.04;
  // The jaw narrows toward the chin; a strong jaw less, a child's round face less.
  out.x *= 1 - ease(-0.3, -1, d.y) * (0.28 - shape.jaw * 0.1 - young * 0.12);
  // The back of the skull tucks in above the nape; the face is a little flatter than the skull.
  if (d.z < 0) out.z *= 1 - 0.22 * ease(-0.25, -0.95, d.y);
  out.z *= 1 - 0.05 * ease(0.55, 0.95, d.z);
  return out;
}

// Where an eye sits: the centre of the eyeball (sunk so most of its front shows) and the way it looks.
export function eyeSocket(
  shape: HeadShape,
  side: 1 | -1,
): { centre: Vector3; forward: Vector3 } {
  const eyes = eyeLine(shape.young);
  const direction = new Vector3(side * eyeApart, eyes, 0).setZ(
    Math.sqrt(1 - eyeApart * eyeApart - eyes * eyes),
  );
  const surface = sculpt(shape, direction);
  const forward = new Vector3(side * 0.1, 0, 1).normalize();
  const centre = surface
    .clone()
    .addScaledVector(forward, -0.55 * eyeSize(shape.young));
  return { centre, forward };
}

export function headGeometry(shape: HeadShape): BufferGeometry {
  const sphere = new SphereGeometry(1, 64, 48).rotateY(-Math.PI / 2);
  sphere.deleteAttribute("uv");
  sphere.deleteAttribute("normal");
  const geometry = mergeVertices(sphere);
  const position = geometry.getAttribute("position");
  const uvs: number[] = [];
  const d = new Vector3();
  const at = new Vector3();
  for (let index = 0; index < position.count; index += 1) {
    d.fromBufferAttribute(position, index).normalize();
    sculpt(shape, d, at);
    position.setXYZ(index, at.x, at.y, at.z);
    // On the front, the painted face; round the sides and back, past its edge (where it is plain skin).
    const across = Math.abs(d.x) * faceScale;
    const u = d.z >= 0.3 ? across : Math.max(across, 0.5 + (0.3 - d.z));
    uvs.push(0.5 + (d.x < 0 ? -u : u), 0.5 + (d.y - faceCentre) * faceScale);
  }
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

// An ear: a flattened shell folded back at its rim.
export function earGeometry(): BufferGeometry {
  const geometry = new SphereGeometry(1, 16, 12);
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const fold = x > 0 ? 0.35 : 1;
    position.setXYZ(index, x * 0.35 * fold, y, z * 0.7 - Math.max(0, x) * 0.2);
  }
  geometry.computeVertexNormals();
  return geometry;
}
