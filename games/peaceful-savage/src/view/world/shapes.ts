import {
  type BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Mesh,
  type Material,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from "three";

// Small helpers for building furniture out of simple solids, each placed in one call. Nothing in the Savage house has a right angle,
// so a "block" is a pebble: a slab whose outline is rounded like a river stone and whose edges are rolled over.
const pebbles = new Map<string, BufferGeometry>();

// A flat outline with round corners, `wide` by `high` about the middle.
export function roundOutline(
  wide: number,
  high: number,
  radius: number,
): Shape {
  const r = Math.min(radius, wide / 2, high / 2);
  const [x, y] = [wide / 2, high / 2];
  const shape = new Shape();
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y);
  shape.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x, y - r);
  shape.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-x + r, y);
  shape.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-x, -y + r);
  shape.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

export function pebble(
  wide: number,
  high: number,
  deep: number,
): BufferGeometry {
  const key = [wide, high, deep].map((size) => size.toFixed(3)).join("x");
  const known = pebbles.get(key);
  if (known !== undefined) return known;
  // The thinnest way is its thickness; its outline is rounded in the other two.
  const thin = Math.min(wide, high, deep);
  const [a, b] =
    thin === deep ? [wide, high] : thin === high ? [wide, deep] : [deep, high];
  const roll = Math.min(thin * 0.45, 0.07);
  const corner = Math.min(0.42 * Math.min(a, b), 0.45);
  const geometry = new ExtrudeGeometry(
    roundOutline(a - roll * 2, b - roll * 2, corner),
    {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: roll,
      bevelThickness: roll,
      curveSegments: 6,
      depth: thin - roll * 2,
    },
  );
  geometry.center();
  if (thin === high && thin !== deep) geometry.rotateX(Math.PI / 2);
  else if (thin === wide && thin !== deep) geometry.rotateY(Math.PI / 2);
  pebbles.set(key, geometry);
  return geometry;
}

export function block(
  material: Material,
  size: readonly [number, number, number],
  at: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(pebble(...size), material);
  mesh.position.set(...at);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A solid standing on a floor plan: the outline given as points on the ground (x, z), raised `height`.
export function prism(
  outline: readonly (readonly [number, number])[],
  height: number,
): BufferGeometry {
  const shape = new Shape();
  outline.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  return new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: height,
  }).rotateX(-Math.PI / 2);
}

export function drum(
  material: Material,
  radius: number,
  height: number,
  at: readonly [number, number, number],
  segments = 20,
): Mesh {
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, height, segments),
    material,
  );
  mesh.position.set(...at);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function ball(
  material: Material,
  radius: number,
  at: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(new SphereGeometry(radius, 16, 12), material);
  mesh.position.set(...at);
  mesh.castShadow = true;
  return mesh;
}

export function ring(
  material: Material,
  radius: number,
  tube: number,
  at: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(new TorusGeometry(radius, tube, 8, 32), material);
  mesh.position.set(...at);
  return mesh;
}

// A rectangle on the floor plan with its corners rounded, as points (x, z) round it.
export function roundPlan(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  radius: number,
): [number, number][] {
  const r = Math.min(radius, (x1 - x0) / 2, (z1 - z0) / 2);
  const corners = [
    [x1 - r, z0 + r, -Math.PI / 2],
    [x1 - r, z1 - r, 0],
    [x0 + r, z1 - r, Math.PI / 2],
    [x0 + r, z0 + r, Math.PI],
  ] as const;
  return corners.flatMap(([x, z, from]) =>
    Array.from({ length: 7 }, (_, step): [number, number] => {
      const angle = from + (step / 6) * (Math.PI / 2);
      return [x + Math.cos(angle) * r, z + Math.sin(angle) * r];
    }),
  );
}

// The opening of a doorway, as points (across, up) from one foot to the other: straight to where the arch springs, then a tall
// half-oval over the top. Every doorway in the house is this shape.
export const archSpring = 1.25;
export function archway(
  from: number,
  to: number,
  top: number,
): [number, number][] {
  const middle = (from + to) / 2;
  const half = (to - from) / 2;
  return [
    [from, 0],
    ...Array.from({ length: 25 }, (_, step): [number, number] => {
      const angle = (step / 24) * Math.PI;
      return [
        middle - Math.cos(angle) * half,
        archSpring + Math.sin(angle) * (top - archSpring),
      ];
    }),
    [to, 0],
  ];
}
