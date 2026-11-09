import {
  BufferAttribute,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { taperedTube } from "../body/tube.ts";
import { noise } from "../palette.ts";
import { inkMaterial, toon } from "../toon.ts";
import { groundAt } from "./meadow.ts";
import { head, scales } from "./serpent-head.ts";

// The giant sly snake on the hill, made of every feeling the bloodline was told to put away. From the start it lies asleep round the
// hilltop, grey, breathing slow and deep, its chin on its own coil and its heavy eyes shut; all along it lie the small curled figures of
// the ancestors trapped in it (Savage Vision makes them glow). When the family comes in their jackets it wakes and rises in an S to a
// head that looks down at them with sorrowful eyes (no fangs, nothing to fear: it is grief, not menace); as the family works the moment
// through it warms to gold from the tail up; and when the tree is lit it lets them go: the body fades, and the ancestors light up gold
// and rise out of it, home (they come to the tree in the hall: see ancestors.ts).
export interface Serpent {
  readonly group: Group;
  // `wake` 0 asleep to 1 risen, `gold` 0 to 1 as it is healed, the seconds since the tree was lit (0 before), and whether Savage
  // Vision is open.
  update(
    wake: number,
    gold: number,
    release: number,
    time: number,
    vision: boolean,
  ): void;
}

const centre = new Vector3(0, groundAt(0, -18), -18);
const rows = 140;
const sides = 14;

const smooth = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// Thick through the coil, fine at the tail, a little narrower at the neck.
const girth = (t: number): number =>
  0.12 + 0.68 * smooth(0, 0.3, t) - 0.18 * smooth(0.82, 1, t);

// A point round the hilltop (measured from its middle), `lift` over the ground there.
const over = (x: number, z: number, lift: number): Vector3 =>
  new Vector3(x, groundAt(x, centre.z + z) - centre.y + lift, z);

// Coiled once and a half round the hilltop on the ground, each turn lying a little on the one outside it; then the neck. Asleep, it is
// laid across the hilltop with the chin on the coil and the face to the house; awake, it rises in an S toward the house, where the
// family comes from.
function path(awake: boolean): CatmullRomCurve3 {
  const points: Vector3[] = [];
  for (let at = 0; at <= 16; at += 1) {
    const t = at / 16;
    const angle = Math.PI * 0.5 + t * Math.PI * 3;
    const radius = 4.2 - t * 1.6;
    const lift = girth(t * 0.8) * 0.85 + t * (awake ? 1.1 : 0.75);
    points.push(over(Math.cos(angle) * radius, Math.sin(angle) * radius, lift));
  }
  const neck = awake
    ? [
        [-1.2, 1.6, 2.4],
        [0.6, 3.1, 2.4],
        [0.2, 4.4, 1.8],
        [0, 4.9, 3.1],
      ]
    : [
        [-0.9, 0.7, -0.9],
        [-0.45, 0.7, 0.7],
        [0.15, 1.3, 2],
        [0, 2, 2.9],
      ];
  for (const [x = 0, y = 0, z = 0] of neck) points.push(new Vector3(x, y, z));
  return new CatmullRomCurve3(points);
}

// Where one of the curled ancestors lies on the body, on its top or its sides: `around` 0 is one side, a half turn the top.
function lying(curve: CatmullRomCurve3, t: number, around: number): Vector3 {
  const along = curve.getTangentAt(t);
  const side = along.clone().cross(new Vector3(0, 1, 0));
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const top = side.clone().cross(along).normalize();
  const r = girth(t) + 0.03;
  return curve
    .getPointAt(t)
    .addScaledVector(side, Math.cos(around) * r)
    .addScaledVector(top, Math.sin(around) * r);
}

export function buildSerpent(count: number): Serpent {
  const random = noise(2_027);
  const group = new Group();
  // Everything is placed from the hilltop, so the whole of it can breathe.
  const coil = new Group();
  coil.position.copy(centre);
  group.add(coil);
  const asleep = path(false);
  const awake = path(true);
  const rest = asleep.getSpacedPoints(rows - 1);
  const risen = awake.getSpacedPoints(rows - 1);
  const shape = taperedTube(rest, { radius: girth, sides });
  const positions = Float32Array.from(shape.getAttribute("position").array);
  const normals = Float32Array.from(shape.getAttribute("normal").array);
  const placed = new BufferAttribute(positions, 3);
  const turned = new BufferAttribute(normals, 3);
  shape.setAttribute("position", placed);
  shape.setAttribute("normal", turned);
  const shades = new Float32Array(placed.count * 3);
  shape.setAttribute("color", new BufferAttribute(shades, 3));
  const skin = toon(
    { value: 1 },
    {
      color: "#ffffff",
      emissive: "#ffc04a",
      emissiveIntensity: 0.1,
      emissiveMap: scales(),
      rim: 0.35,
      transparent: true,
      vertexColors: true,
    },
  );
  const body = new Mesh(shape, skin);
  const ink = new Mesh(shape, inkMaterial(0.03));
  body.add(ink);
  coil.add(body);
  // The head has no colours of its own along it: it turns gold all at once, last.
  const headSkin = toon(
    { value: 1 },
    {
      color: "#8f8ea8",
      emissive: "#ffc04a",
      emissiveIntensity: 0.1,
      emissiveMap: scales(),
      rim: 0.35,
      transparent: true,
    },
  );
  const face = head(headSkin);
  coil.add(face.made);
  // The ancestors, curled small along the body.
  const figure = mergeGeometries([
    new CapsuleGeometry(0.07, 0.1, 4, 8).rotateX(1.2),
    new SphereGeometry(0.065, 8, 6).translate(0, 0.08, 0.08),
  ]);
  const figureSkin = new MeshStandardMaterial({
    color: "#b7b4cc",
    emissive: "#ffb84a",
    emissiveIntensity: 0,
    roughness: 0.8,
  });
  const figures = new InstancedMesh(
    figure ?? new SphereGeometry(0.08),
    figureSkin,
    count,
  );
  figures.frustumCulled = false;
  coil.add(figures);
  const slots = Array.from({ length: count }, () => {
    const t = random();
    const around = (random() * 1.6 - 0.3) * Math.PI;
    return {
      awake: lying(awake, t, around),
      rest: lying(asleep, t, around),
      spin: random() * Math.PI * 2,
      t,
    };
  });
  const matrix = new Matrix4();
  const here = new Vector3();
  const size = new Vector3();
  const turn = new Quaternion();
  const spinAxis = new Vector3(0, 1, 0);
  const grey = new Color("#8f8ea8");
  const golden = new Color("#f0b84c");
  const shade = new Color();
  const end = new Vector3();
  // How far awake the body was last laid out, the figures last placed, and the gold last painted (-1: not yet).
  let built = 0;
  let laid = -1;
  let painted = -1;
  // The body laid out between asleep and awake: the spine eased from one to the other, the tube made again round it.
  const layOut = (wake: number): void => {
    const spine = rest.map((point, row) =>
      point.clone().lerp(risen[row] ?? point, wake),
    );
    const next = taperedTube(spine, { radius: girth, sides });
    positions.set(next.getAttribute("position").array);
    normals.set(next.getAttribute("normal").array);
    next.dispose();
    placed.needsUpdate = true;
    turned.needsUpdate = true;
    shape.computeBoundingSphere();
    built = wake;
  };
  return {
    group,
    update(wake, gold, release, time, vision) {
      // Gone once the last of them has risen out of it.
      group.visible = release < 2.5;
      if (!group.visible) return;
      const fade = smooth(0, 1.6, release);
      // Asleep it breathes, slow and deep; awake it holds its breath.
      const breath = Math.sin(time * 0.55) * (1 - wake);
      coil.scale.set(1 + breath * 0.012, 1 + breath * 0.02, 1 + breath * 0.012);
      if (Math.abs(wake - built) > 0.002) layOut(wake);
      if (Math.abs(gold - painted) > 0.005) {
        painted = gold;
        for (let row = 0; row < rows; row += 1) {
          // Healed from the tail (row 0) up to how far the moment has come.
          const healed = 1 - smooth(gold - 0.06, gold, row / rows);
          shade.copy(grey).lerp(golden, healed);
          for (let side = 0; side < sides; side += 1)
            shades.set([shade.r, shade.g, shade.b], (row * sides + side) * 3);
        }
        shade.copy(gold >= 1 ? golden : grey);
        shades.set([shade.r, shade.g, shade.b], rows * sides * 3);
        shades.set([shade.r, shade.g, shade.b], rows * sides * 3 + 3);
        shape.getAttribute("color").needsUpdate = true;
        slots.forEach((slot, index) => {
          figures.setColorAt(index, slot.t < gold ? golden : grey);
        });
        if (figures.instanceColor !== null)
          figures.instanceColor.needsUpdate = true;
      }
      // Savage Vision shows who is curled up inside it while it sleeps.
      const seen = vision ? (1 - wake) * (0.8 + Math.sin(time * 2.2) * 0.2) : 0;
      skin.emissiveIntensity = 0.1 + gold * 1.4 + fade + seen * 0.35;
      skin.opacity = 1 - fade;
      body.visible = fade < 0.999;
      headSkin.color.copy(grey).lerp(golden, smooth(0.9, 1, gold));
      headSkin.emissiveIntensity = skin.emissiveIntensity;
      headSkin.opacity = skin.opacity;
      ink.visible = fade < 0.2;
      // The ancestors light up as they are let go.
      figureSkin.emissiveIntensity =
        gold * 0.8 + smooth(0, 1.2, release) * 0.6 + seen * 0.7;
      // The head rests on the coil, eyes shut, rising and falling with the breath; awake, it looks down at the family.
      const last = rows - 1;
      end.copy(rest[last] ?? end).lerp(risen[last] ?? end, wake);
      face.made.position
        .copy(end)
        .add(new Vector3(0, Math.sin(time * 0.55) * 0.04 * (1 - wake), 0.5));
      face.made.position.y += Math.sin(time) * 0.08 * wake;
      face.made.scale.setScalar(1 - fade);
      face.made.rotation.set(
        0.12 + wake * (0.43 + Math.sin(time * 0.5) * 0.05),
        Math.sin(time * 0.4) * 0.2 * wake,
        0,
      );
      const open = smooth(0.35, 0.9, wake);
      for (const lid of face.lids) lid.rotation.x = 1.5 - open * 0.75;
      for (const iris of face.irises) iris.visible = open > 0.25;
      // The figures lie still while it sleeps; they are placed again only while it wakes, sways awake, or lets them go.
      if (laid >= 0 && wake < 0.001 && laid < 0.001 && release === 0) return;
      laid = wake;
      slots.forEach((slot, index) => {
        here.copy(slot.rest).lerp(slot.awake, wake);
        here.y += Math.sin(time * 1.5 + slot.t * 12) * 0.03 * wake;
        // Let go, the tail first: each lights up and rises out of the body, home.
        const going = smooth(slot.t * 0.5, slot.t * 0.5 + 1.5, release);
        here.y += going * 6;
        size.setScalar(1 - going);
        turn.setFromAxisAngle(spinAxis, slot.spin + time * 0.2 * wake);
        matrix.compose(here, turn, size);
        figures.setMatrixAt(index, matrix);
      });
      figures.instanceMatrix.needsUpdate = true;
    },
  };
}
