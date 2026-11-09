import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  Mesh,
  type Material,
  SphereGeometry,
  TorusGeometry,
} from "three";

// Small helpers for building furniture out of simple solids: a box, a cylinder, a ball, a ring, each placed in one call.
const boxes = new Map<string, BufferGeometry>();
const unitBox = (): BufferGeometry => {
  const made = boxes.get("box") ?? new BoxGeometry(1, 1, 1);
  boxes.set("box", made);
  return made;
};

export function block(
  material: Material,
  size: readonly [number, number, number],
  at: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(unitBox(), material);
  mesh.scale.set(...size);
  mesh.position.set(...at);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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
