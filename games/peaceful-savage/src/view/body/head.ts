import {
  type BufferGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

import type { Head } from "./head-shape.ts";

// The head's skin, grown from a ball: each point of the ball is moved out (or in) to where the sculpted head is in its direction. The
// rest of the face (brows, the lines of the nose, the lips and the moods of the mouth) is painted onto it, as a picture of the face
// seen from the front: a point of the face at (x, y) is drawn at (0.5 + x * k, 0.5 + (y - c) * k) of the picture.
export type Expression = "calm" | "open" | "smile" | "smirk" | "worry";
export const expressions: readonly Expression[] = [
  "calm",
  "open",
  "smile",
  "smirk",
  "worry",
];

export const faceScale = 0.5;
export const faceCentre = -0.3;

// The head's skin; or, `plain`, the head without its hollows, for the ink line round it.
export function headGeometry(head: Head, plain = false): BufferGeometry {
  const sphere = new SphereGeometry(1, 80, 60).rotateY(-Math.PI / 2);
  sphere.deleteAttribute("uv");
  sphere.deleteAttribute("normal");
  const geometry = mergeVertices(sphere);
  const position = geometry.getAttribute("position");
  const uvs: number[] = [];
  const d = new Vector3();
  const at = new Vector3();
  for (let index = 0; index < position.count; index += 1) {
    d.fromBufferAttribute(position, index).normalize();
    head.surface(d, at, plain);
    position.setXYZ(index, at.x, at.y, at.z);
    // On the front, the painted face; round the sides and back, past its edge (where it is plain skin).
    const across = Math.abs(at.x) * faceScale;
    const u = d.z >= 0.3 ? across : Math.max(across, 0.5 + (0.3 - d.z));
    uvs.push(0.5 + (at.x < 0 ? -u : u), 0.5 + (at.y - faceCentre) * faceScale);
  }
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

// An ear (the right one; the left is the same, mirrored): a shell, wider at the top than at the lobe, its rim rolled forward and its
// bowl pressed in, standing a little off the head.
export function earGeometry(): BufferGeometry {
  const geometry = new SphereGeometry(1, 20, 16);
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    // x faces out from the head: the outer face is pressed into a bowl; the inner face lies flat against the head.
    const bowl = x > 0 ? 0.25 + 0.75 * Math.min(1, Math.hypot(y, z) ** 3) : 1;
    const lobe = y < 0 ? 0.62 + 0.38 * (1 + y) : 1;
    position.setXYZ(
      index,
      x * 0.3 * bowl,
      y * (y < 0 ? 0.9 : 1),
      z * 0.62 * lobe + Math.max(0, x) * 0.12,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}
