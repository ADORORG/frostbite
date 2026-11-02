import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";

// The pieces the woods are built from in three dimensions: shared shapes (each scaled where it is used), paints shared by colour and
// finish, and a part (a shape in a paint, placed, casting and taking shadows). Everything is low-poly and flat-shaded, like carved toys.
export const shapes = {
  ball: new SphereGeometry(1, 14, 10),
  block: new BoxGeometry(1, 1, 1),
  cone: new ConeGeometry(1, 1, 10),
  cylinder: new CylinderGeometry(1, 1, 1, 12),
  gem: new OctahedronGeometry(1),
  ring: new TorusGeometry(1, 0.18, 8, 20),
  rock: new IcosahedronGeometry(1, 0),
  smoothBall: new SphereGeometry(1, 24, 16),
} as const;

export interface Finish {
  // A colour it glows with, and how brightly.
  readonly glow?: string;
  readonly glowing?: number;
  readonly metal?: number;
  readonly opacity?: number;
  readonly rough?: number;
  readonly smooth?: boolean;
}

const paints = new Map<string, MeshStandardMaterial>();

// A paint of its own, for a part whose look changes while it is played (a light turning green, eyes glowing red).
export const ownPaint = (
  colour: string,
  finish: Finish = {},
): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color: new Color(colour),
    emissive: new Color(finish.glow ?? "#000000"),
    emissiveIntensity: finish.glowing ?? (finish.glow === undefined ? 0 : 1),
    flatShading: finish.smooth !== true,
    metalness: finish.metal ?? 0,
    opacity: finish.opacity ?? 1,
    roughness: finish.rough ?? 0.75,
    transparent: finish.opacity !== undefined,
  });

// A paint shared by every part of that colour and finish.
export function paint(
  colour: string,
  finish: Finish = {},
): MeshStandardMaterial {
  const key = `${colour} ${JSON.stringify(finish)}`;
  const found = paints.get(key);
  if (found !== undefined) return found;
  const made = ownPaint(colour, finish);
  paints.set(key, made);
  return made;
}

export interface Place {
  readonly at?: readonly [number, number, number];
  readonly size?: readonly [number, number, number] | number;
  readonly turn?: readonly [number, number, number];
}

export function part(
  shape: BufferGeometry,
  material: Material,
  { at = [0, 0, 0], size = 1, turn = [0, 0, 0] }: Place = {},
): Mesh {
  const mesh = new Mesh(shape, material);
  mesh.position.set(...at);
  if (typeof size === "number") mesh.scale.setScalar(size);
  else mesh.scale.set(...size);
  mesh.rotation.set(...turn);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function group(
  children: readonly Object3D[],
  at: readonly [number, number, number] = [0, 0, 0],
): Group {
  const made = new Group();
  made.position.set(...at);
  for (const child of children) made.add(child);
  return made;
}

// Eases from 0 to 1 and stays there: slow at the start and the end.
export const ease = (share: number): number => {
  const t = Math.min(1, Math.max(0, share));
  return t * t * (3 - 2 * t);
};

// Moves a value toward another, the same share of the way for the same time whatever the frame rate.
export const toward = (
  from: number,
  to: number,
  dt: number,
  rate = 10,
): number => from + (to - from) * (1 - Math.exp(-dt * rate));

// The shortest turn from one angle to another, so a turn never goes the long way round.
export const turnToward = (
  from: number,
  to: number,
  dt: number,
  rate = 12,
): number => {
  const gap = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + gap * (1 - Math.exp(-dt * rate));
};
