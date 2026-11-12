import {
  Color,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  type Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

import { noise } from "../palette.ts";
import { coilGeometry } from "./coils.ts";
import type { Head } from "./head-shape.ts";

// The hair that lies close to the head: short coils grown from the skin itself, following the true shape of the skull to a clean
// hairline, over a dark cap that hugs the scalp so no skin shows between them. Under a puff or an afro it is the hair drawn back; on Kai
// it is his fade, the coils shorter and shorter down the sides and the back until they are a shadow on the skin.
export interface ScalpOptions {
  readonly cap: Material;
  readonly colour: string;
  readonly count: number;
  readonly detail: number;
  // Whether hair grows at a point of the head (the head's own units).
  readonly grows: (at: Vector3) => boolean;
  // How long the coils are at a point (1 full, 0 a shadow).
  readonly long: (at: Vector3) => number;
  readonly material: Material;
  // From the head's own units to the parent's space.
  readonly place: (at: Vector3) => Vector3;
  readonly size: number;
}

export function scalp(
  parent: Object3D,
  head: Head,
  options: ScalpOptions,
): InstancedMesh {
  // The cap: a skin of dark just off the scalp wherever hair grows, folded away inside the head everywhere else.
  const geometry = new SphereGeometry(1, 56, 40);
  const position = geometry.getAttribute("position");
  const direction = new Vector3();
  const skin = new Vector3();
  const inside = new Vector3(0, 0.1, -0.05);
  for (let index = 0; index < position.count; index += 1) {
    direction.fromBufferAttribute(position, index).normalize();
    head.surface(direction, skin, true);
    if (options.grows(skin)) skin.addScaledVector(direction, 0.012);
    else skin.lerp(inside, 0.55);
    const at = options.place(skin);
    position.setXYZ(index, at.x, at.y, at.z);
  }
  geometry.computeVertexNormals();
  parent.add(new Mesh(geometry, options.cap));
  const random = noise(3);
  const mesh = new InstancedMesh(
    coilGeometry(options.detail),
    options.material,
    options.count,
  );
  const base = new Color(options.colour);
  const matrix = new Matrix4();
  const up = new Vector3(0, 1, 0);
  const out = new Vector3();
  for (let at = 0; at < options.count; at += 1) {
    for (let tries = 0; tries < 30; tries += 1) {
      direction
        .set(random() * 2 - 1, random() * 2 - 0.6, random() * 2 - 1.25)
        .normalize();
      head.surface(direction, skin, true);
      if (options.grows(skin)) break;
    }
    const long = options.long(skin);
    out
      .copy(direction)
      .add(
        new Vector3(
          random() - 0.5,
          random() - 0.5,
          random() - 0.5,
        ).multiplyScalar(0.8),
      )
      .normalize();
    const scale = options.size * (0.75 + random() * 0.5);
    matrix.compose(
      options.place(skin.addScaledVector(direction, 0.02 * long)),
      new Quaternion()
        .setFromUnitVectors(up, out)
        .multiply(
          new Quaternion().setFromAxisAngle(up, random() * Math.PI * 2),
        ),
      new Vector3(scale, scale * (0.25 + 0.9 * long), scale),
    );
    mesh.setMatrixAt(at, matrix);
    mesh.setColorAt(
      at,
      base.clone().multiplyScalar(0.7 + random() * 0.5 + 0.2 * long),
    );
  }
  parent.add(mesh);
  return mesh;
}
