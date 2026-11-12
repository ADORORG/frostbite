import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";

// A tube along a run of points whose thickness changes along it: a brow thick at its inner end and fine at its tail, the dark line of an
// upper lid, a feather's shaft. Each ring's frame is carried along from the last (parallel transport), so the tube never twists. `across`
// squashes the tube in one direction (a brow lies flat on the forehead); the ends are closed. Texture runs round the tube there and back
// (so it meets itself without a seam) and along it by length, a unit a metre.
export interface TubeShape {
  readonly across?: number;
  readonly radius: (t: number) => number;
  readonly sides: number;
  // The direction the squashed side faces at the start (the tube is flattened against it); world up by default.
  readonly up?: Vector3;
}

export function taperedTube(
  points: readonly Vector3[],
  shape: TubeShape,
): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const along: number[] = [];
  const indices: number[] = [];
  const count = points.length;
  const sides = shape.sides;
  const across = shape.across ?? 1;
  const tangents = points.map((point, index) => {
    const before = points[Math.max(0, index - 1)] ?? point;
    const after = points[Math.min(count - 1, index + 1)] ?? point;
    return after.clone().sub(before).normalize();
  });
  const first = tangents[0] ?? new Vector3(1, 0, 0);
  const up = (shape.up ?? new Vector3(0, 1, 0)).clone();
  const start = Math.abs(up.dot(first)) > 0.95 ? new Vector3(1, 0, 0) : up;
  const normal = start.sub(first.clone().multiplyScalar(start.dot(first)));
  normal.normalize();
  points.forEach((point, index) => {
    const tangent = tangents[index] ?? first;
    const previous = tangents[index - 1];
    if (previous !== undefined) {
      const axis = previous.clone().cross(tangent);
      const turn = Math.acos(Math.min(1, Math.max(-1, previous.dot(tangent))));
      if (axis.lengthSq() > 1e-12)
        normal.applyAxisAngle(axis.normalize(), turn);
    }
    const binormal = tangent.clone().cross(normal).normalize();
    const r = shape.radius(index / Math.max(1, count - 1));
    const before = points[index - 1];
    const length =
      (along[index - 1] ?? 0) +
      (before === undefined ? 0 : point.distanceTo(before));
    along.push(length);
    for (let at = 0; at < sides; at += 1) {
      const angle = (at / sides) * Math.PI * 2;
      uvs.push(Math.abs((at / sides) * 2 - 1), length);
      positions.push(
        point.x +
          normal.x * Math.cos(angle) * r +
          binormal.x * Math.sin(angle) * r * across,
        point.y +
          normal.y * Math.cos(angle) * r +
          binormal.y * Math.sin(angle) * r * across,
        point.z +
          normal.z * Math.cos(angle) * r +
          binormal.z * Math.sin(angle) * r * across,
      );
    }
  });
  for (let row = 0; row < count - 1; row += 1)
    for (let at = 0; at < sides; at += 1) {
      const a = row * sides + at;
      const b = row * sides + ((at + 1) % sides);
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
  // Each end closed with a fan to a point on the line.
  const ends = [
    [0, -1],
    [count - 1, 1],
  ] as const;
  for (const [row, out] of ends) {
    const centre = points[row] ?? new Vector3();
    const tip = positions.length / 3;
    positions.push(centre.x, centre.y, centre.z);
    uvs.push(0.5, along[row] ?? 0);
    for (let at = 0; at < sides; at += 1) {
      const a = row * sides + at;
      const b = row * sides + ((at + 1) % sides);
      if (out > 0) indices.push(tip, a, b);
      else indices.push(tip, b, a);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
