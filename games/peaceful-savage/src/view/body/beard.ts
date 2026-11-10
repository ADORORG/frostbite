import {
  Color,
  InstancedMesh,
  type Material,
  Matrix4,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";

import { noise } from "../palette.ts";
import { coilGeometry } from "./coils.ts";
import type { Head } from "./head-shape.ts";

// Daddy's beard as the cover has it: a goatee on the chin, a moustache over the lip and a close, short beard along the jaw, each curl
// set on the skin itself and grown straight out of it.
export function beard(
  parent: Object3D,
  head: Head,
  place: (at: Vector3) => Vector3,
  options: {
    readonly colour: string;
    readonly count: number;
    readonly detail: number;
    readonly size: number;
  },
  material: Material,
): InstancedMesh {
  const L = head.layout;
  const random = noise(37);
  // How thickly the beard grows at a point of the face (in the head's own units): 1 on the chin and lip, thin along the jaw.
  const thickness = (at: Vector3): number => {
    const x = Math.abs(at.x);
    if (at.z < 0.02) return 0;
    if (at.y < L.mouth - 0.06 && at.y > L.chin - 0.1 && x < 0.27) return 1;
    if (
      at.y > L.mouth + 0.05 &&
      at.y < L.nose - 0.02 &&
      x < 0.17 + (L.nose - at.y) * 0.5 &&
      at.z > 0.5
    )
      return 1;
    if (at.y < L.mouth - 0.14 && at.z > -0.18) return 0.3;
    return 0;
  };
  const mesh = new InstancedMesh(
    coilGeometry(options.detail),
    material,
    options.count,
  );
  const up = new Vector3(0, 1, 0);
  const base = new Color(options.colour);
  const matrix = new Matrix4();
  const step = 0.01;
  const normal = (at: Vector3): Vector3 => {
    const along = (x: number, y: number, z: number) =>
      head.distance(at.clone().add(new Vector3(x, y, z))) -
      head.distance(at.clone().sub(new Vector3(x, y, z)));
    return new Vector3(
      along(step, 0, 0),
      along(0, step, 0),
      along(0, 0, step),
    ).normalize();
  };
  let placed = 0;
  for (
    let tries = 0;
    placed < options.count && tries < options.count * 60;
    tries += 1
  ) {
    const d = new Vector3(
      random() * 1.4 - 0.7,
      -random() * 1.3,
      random() * 1.2 - 0.1,
    ).normalize();
    const at = head.surface(d);
    if (random() > thickness(at)) continue;
    const out = normal(at);
    const spin = new Quaternion()
      .setFromUnitVectors(up, out)
      .multiply(new Quaternion().setFromAxisAngle(up, random() * Math.PI * 2));
    const scale = options.size * (0.65 + random() * 0.6);
    matrix.compose(
      place(at.addScaledVector(out, 0.012)),
      spin,
      new Vector3(scale, scale * 0.8, scale),
    );
    mesh.setMatrixAt(placed, matrix);
    mesh.setColorAt(
      placed,
      base.clone().offsetHSL(0, 0, (random() - 0.5) * 0.05),
    );
    placed += 1;
  }
  mesh.count = placed;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
