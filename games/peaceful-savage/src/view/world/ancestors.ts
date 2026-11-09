import {
  CapsuleGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { ease, farewell } from "../farewell.ts";
import { noise } from "../palette.ts";

// The ancestors come home. When the tree is lit, the ones the giant snake let go stand round the ancestor tree in the hall, behind the
// family: among its roots, and in the air in rings up toward the crown, facing the family, their arms a little open in greeting. They
// are drawn like the rest of the magic, in gold line: lit at their edges, clear through the middle. They fade in as the family turns to
// the screen, shine through the big hug, and then rise into the tree and fade.
export interface Ancestors {
  readonly group: Group;
  // The seconds since the tree was lit (null before it is), and the time.
  update(since: number | null, time: number): void;
}

const tree = new Vector3(0, 0, 6);
// Where the family hugs, for the ancestors to face.
const family = new Vector3(0, 0, 4);
const tiers = [
  { count: 14, height: 0, high: 0, radius: 1.65, scale: 1, spread: 0.6 },
  { count: 14, height: 1.5, high: 0.6, radius: 1.4, scale: 0.86, spread: 0.7 },
  { count: 12, height: 2.7, high: 0.8, radius: 1.0, scale: 0.74, spread: 0.8 },
];

const vertexShader = /* glsl */ `
  attribute float shown;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vShown;
  void main() {
    #ifdef USE_INSTANCING
      vec4 local = instanceMatrix * vec4(position, 1.0);
      vec3 turned = mat3(instanceMatrix) * normal;
    #else
      vec4 local = vec4(position, 1.0);
      vec3 turned = normal;
    #endif
    vec4 seen = modelViewMatrix * local;
    vNormal = normalize(normalMatrix * turned);
    vView = -seen.xyz;
    vShown = shown;
    gl_Position = projectionMatrix * seen;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBody;
  uniform vec3 uGold;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vShown;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - facing, 2.0);
    float alpha = (0.26 + rim * 0.74) * vShown;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(mix(uBody, uGold * 2.2, rim), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// One of them, in one smooth outline so the gold line runs round the whole of them: a long robe, a waist, shoulders, a neck, and a head
// with its hair up in a crown of coils; and two arms held a little open, palms out, in greeting.
const outline = [
  [0, 0],
  [0.25, 0],
  [0.26, 0.05],
  [0.22, 0.4],
  [0.16, 0.8],
  [0.15, 0.95],
  [0.2, 1.18],
  [0.23, 1.3],
  [0.19, 1.37],
  [0.08, 1.42],
  [0.06, 1.47],
  [0.1, 1.51],
  [0.125, 1.58],
  [0.165, 1.67],
  [0.175, 1.76],
  [0.15, 1.84],
  [0.09, 1.89],
  [0, 1.91],
].map(([x = 0, y = 0]) => new Vector2(x, y));

export function spiritShape() {
  const arm = (s: number) =>
    new CapsuleGeometry(0.045, 0.5, 4, 8)
      .rotateZ(s * 0.42)
      .translate(s * 0.31, 1.06, 0.03);
  const palm = (s: number) =>
    new SphereGeometry(0.055, 10, 8)
      .scale(1, 1.25, 0.5)
      .translate(s * 0.43, 0.8, 0.05);
  const parts = [
    new LatheGeometry(outline, 18),
    arm(1),
    arm(-1),
    palm(1),
    palm(-1),
  ];
  return mergeGeometries(parts) ?? new SphereGeometry(0.3);
}

// The gold line they are drawn in. Each figure carries how much of it shows (0 to 1) in its `shown` attribute.
export const spiritPaint = (): ShaderMaterial =>
  new ShaderMaterial({
    depthWrite: false,
    fragmentShader,
    transparent: true,
    uniforms: {
      uBody: { value: new Color("#6b3f12") },
      uGold: { value: new Color("#ffd27a") },
    },
    vertexShader,
  });

export function buildAncestors(): Ancestors {
  const random = noise(1_854);
  const group = new Group();
  group.name = "ancestors";
  const shape = spiritShape();
  const count = tiers.reduce((sum, tier) => sum + tier.count, 0);
  const shown = new InstancedBufferAttribute(new Float32Array(count), 1);
  shape.setAttribute("shown", shown);
  const figures = new InstancedMesh(shape, spiritPaint(), count);
  figures.frustumCulled = false;
  group.add(figures);
  // Each one's place: round the back of the tree and up its sides, never between the family and the camera.
  const slots = tiers.flatMap((tier, level) =>
    Array.from({ length: tier.count }, (_, at) => {
      const angle = -1.85 + ((at + 0.2 + random() * 0.6) / tier.count) * 3.7;
      const radius = tier.radius + random() * tier.spread;
      const x = Math.max(-2.5, Math.min(2.5, Math.sin(angle) * radius));
      const place = new Vector3(
        x,
        tier.height + random() * tier.high,
        tree.z + Math.cos(angle) * radius,
      );
      return {
        bob: random() * Math.PI * 2,
        delay: random() * 1.1,
        level,
        place,
        scale: tier.scale * (0.92 + random() * 0.16),
        yaw: Math.atan2(family.x - place.x, family.z - place.z),
      };
    }),
  );
  const matrix = new Matrix4();
  const at = new Vector3();
  const turn = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const size = new Vector3();
  return {
    group,
    update(since, time) {
      group.visible =
        since !== null &&
        since >= farewell.appear[0] &&
        since < farewell.fade[1];
      if (since === null || !group.visible) return;
      const gone = ease(farewell.fade[0], farewell.fade[1], since);
      slots.forEach((slot, index) => {
        const start = farewell.appear[0] + slot.delay;
        const coming = ease(start, start + 0.8, since);
        shown.setX(index, coming * (1 - gone));
        // They rise a little out of the floor as they come, bob in the air, and are drawn up into the crown as they go.
        at.copy(slot.place);
        at.x = tree.x + (at.x - tree.x) * (1 - gone * 0.6);
        at.z = tree.z + (at.z - tree.z) * (1 - gone * 0.6);
        at.y +=
          (coming - 1) * 0.3 +
          (slot.level > 0 ? Math.sin(time * 1.2 + slot.bob) * 0.05 : 0) +
          gone * (2.4 + slot.level);
        size.setScalar(slot.scale * (1 - gone * 0.4));
        turn.setFromAxisAngle(up, slot.yaw);
        matrix.compose(at, turn, size);
        figures.setMatrixAt(index, matrix);
      });
      shown.needsUpdate = true;
      figures.instanceMatrix.needsUpdate = true;
    },
  };
}
