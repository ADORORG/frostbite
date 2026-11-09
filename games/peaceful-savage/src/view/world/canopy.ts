import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// The ancestor tree's crown: clusters of leaves at the ends of the boughs, the figures of the grands and the greats sitting along them,
// and a galaxy turning under the hall's vault above.

// The hall's vault: nothing of the tree may rise through it.
export const under = (point: Vector3): Vector3 => {
  const roof = 3.2 + Math.sqrt(Math.max(0, 9 - point.x * point.x)) - 0.35;
  return point.setY(Math.min(point.y, roof));
};

export function leaves(
  tips: readonly Vector3[],
  random: () => number,
): InstancedMesh {
  const perTip = 34;
  const mesh = new InstancedMesh(
    new SphereGeometry(1, 7, 5),
    new MeshBasicMaterial({ color: "#ffffff", toneMapped: true }),
    tips.length * perTip,
  );
  const matrix = new Matrix4();
  const spin = new Quaternion();
  tips.forEach((tip, index) => {
    for (let leaf = 0; leaf < perTip; leaf += 1) {
      const offset = new Vector3(
        random() - 0.5,
        random() * 0.7 - 0.25,
        random() - 0.5,
      ).multiplyScalar(0.8);
      spin.setFromAxisAngle(
        new Vector3(random(), random(), random()).normalize(),
        random() * Math.PI,
      );
      const size = 0.05 + random() * 0.05;
      matrix.compose(
        under(tip.clone().add(offset)),
        spin,
        new Vector3(size, size * 0.45, size * 1.4),
      );
      mesh.setMatrixAt(index * perTip + leaf, matrix);
    }
  });
  return mesh;
}

export function figures(
  perches: readonly Vector3[],
  random: () => number,
): InstancedMesh {
  const shape = mergeGeometries([
    new CapsuleGeometry(0.035, 0.09, 4, 8),
    new SphereGeometry(0.035, 8, 6).translate(0, 0.1, 0),
    new CapsuleGeometry(0.012, 0.08, 2, 6)
      .rotateZ(0.6)
      .translate(0.05, 0.08, 0),
    new CapsuleGeometry(0.012, 0.08, 2, 6)
      .rotateZ(-0.6)
      .translate(-0.05, 0.08, 0),
  ]);
  const mesh = new InstancedMesh(
    shape ?? new SphereGeometry(0.05),
    new MeshBasicMaterial({ color: "#ffffff" }),
    perches.length,
  );
  const matrix = new Matrix4();
  perches.forEach((perch, index) => {
    matrix.compose(
      perch.clone().add(new Vector3(0, 0.1, 0)),
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        random() * Math.PI * 2,
      ),
      new Vector3(1, 1, 1).multiplyScalar(1.1 + random() * 0.6),
    );
    mesh.setMatrixAt(index, matrix);
  });
  return mesh;
}

export function galaxy(random: () => number): Points {
  const count = 1200;
  const positions = new Float32Array(count * 3);
  for (let at = 0; at < count; at += 1) {
    const arm = at % 3;
    const t = random();
    const angle =
      t * Math.PI * 4 + (arm * Math.PI * 2) / 3 + (random() - 0.5) * 0.4;
    const radius = 0.2 + t * 2.2;
    positions.set(
      [
        Math.cos(angle) * radius,
        5.25 + (random() - 0.5) * 0.12,
        Math.sin(angle) * radius * 1.4,
      ],
      at * 3,
    );
  }
  return new Points(
    new BufferGeometry().setAttribute(
      "position",
      new BufferAttribute(positions, 3),
    ),
    new PointsMaterial({
      blending: AdditiveBlending,
      color: "#ffe2a0",
      depthWrite: false,
      opacity: 0.2,
      size: 0.045,
      transparent: true,
    }),
  );
}
