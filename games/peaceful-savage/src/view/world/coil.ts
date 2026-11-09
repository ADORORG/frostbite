import {
  CapsuleGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// When poor choices have greyed the lead all the way, the sly snakes come for them gently: small grey curled figures rise out of the
// ground in a slow coil round the lead and close in, until the lead is held in the grey with them. Nothing strikes; it is a sad hush,
// and the next run begins in colour.
export interface Coil {
  readonly group: Group;
  // Where the lead stands (or null when nobody has gone grey), and the seconds since they did.
  update(at: Vector3 | null, since: number, time: number): void;
}

const count = 72;

const smooth = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

export function buildCoil(): Coil {
  const group = new Group();
  const figure = mergeGeometries([
    new CapsuleGeometry(0.06, 0.09, 4, 8).rotateX(1.2),
    new SphereGeometry(0.055, 8, 6).translate(0, 0.07, 0.07),
  ]);
  const figures = new InstancedMesh(
    figure ?? new SphereGeometry(0.07),
    new MeshStandardMaterial({ color: "#9a98b0", roughness: 0.9 }),
    count,
  );
  figures.frustumCulled = false;
  group.add(figures);
  group.visible = false;
  const matrix = new Matrix4();
  const turn = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const place = new Vector3();
  const size = new Vector3();
  return {
    group,
    update(at, since, time) {
      group.visible = at !== null;
      if (at === null) return;
      const rise = smooth(0, 2.5, since);
      const close = smooth(2, 5, since);
      for (let index = 0; index < count; index += 1) {
        const t = index / count;
        const angle = t * Math.PI * 7 + time * 0.6;
        const radius = (0.95 - close * 0.4) * (1 - t * 0.35);
        place.set(
          at.x + Math.cos(angle) * radius,
          at.y + t * 2.1 * rise,
          at.z + Math.sin(angle) * radius,
        );
        const grown = smooth(t * 0.7, t * 0.7 + 0.6, rise);
        turn.setFromAxisAngle(up, angle + Math.PI / 2);
        matrix.compose(place, turn, size.setScalar(grown));
        figures.setMatrixAt(index, matrix);
      }
      figures.instanceMatrix.needsUpdate = true;
    },
  };
}
