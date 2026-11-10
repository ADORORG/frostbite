import {
  AdditiveBlending,
  BufferAttribute,
  CapsuleGeometry,
  type CatmullRomCurve3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { smooth } from "../body/profile.ts";
import { taperedTube } from "../body/tube.ts";
import { noise } from "../palette.ts";
import { inkMaterial, toon } from "../toon.ts";
import { buildHead } from "./serpent-head.ts";
import {
  centre,
  girth,
  golds,
  greys,
  path,
  rows,
  scales,
  sides,
  toneAt,
} from "./serpent-shape.ts";

// The giant sly snake on the hill, made of every feeling the bloodline was told to put away (designed in Blender, built here from the
// same numbers). From the start it lies asleep round the hilltop: three loops laid one on another, grey with dark saddles down its back
// and a pale belly, its chin on its own coil and its eyes shut, breathing slow and deep. Savage Vision shows what is hidden in it: the
// small curled figures of the ancestors, all along it. When the family comes in their jackets it wakes and rears up in an S to look down
// at them with sorrowful eyes; as the family works the moment through it warms to gold from the tail up; and when the tree is lit it
// lets them go: the body fades, and the ancestors light up and rise out of it, home (they come to the tree in the hall: see
// ancestors.ts).
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

// Where one of the curled ancestors lies in the body, on its top or its sides: `around` 0 is one side, a quarter turn the top.
function lying(curve: CatmullRomCurve3, t: number, around: number): Vector3 {
  const along = curve.getTangentAt(t);
  const side = along.clone().cross(new Vector3(0, 1, 0));
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const top = side.clone().cross(along).normalize();
  const r = girth(t) * 0.92;
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
  const shades = new BufferAttribute(new Float32Array(placed.count * 3), 3);
  shape.setAttribute("color", shades);
  const uv = shape.getAttribute("uv");
  const tones = Array.from({ length: placed.count }, (_, index) =>
    toneAt(uv.getX(index), uv.getY(index)),
  );
  const skin = toon(
    { value: 1 },
    {
      color: "#ffffff",
      emissive: "#ffc04a",
      emissiveIntensity: 0.1,
      emissiveMap: scales(),
      rim: 0.3,
      transparent: true,
      vertexColors: true,
    },
  );
  const body = new Mesh(shape, skin);
  body.castShadow = true;
  const ink = new Mesh(shape, inkMaterial(0.03));
  body.add(ink);
  coil.add(body);
  const head = buildHead(skin);
  coil.add(head.made);
  // The ancestors hidden in it, curled small all along the body: light, seen in Savage Vision and as they are let go.
  const figure = mergeGeometries([
    new CapsuleGeometry(0.09, 0.13, 4, 8).rotateX(1.2),
    new SphereGeometry(0.085, 8, 6).translate(0, 0.1, 0.1),
  ]);
  const light = new MeshBasicMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const figures = new InstancedMesh(
    figure ?? new SphereGeometry(0.1),
    light,
    count,
  );
  figures.frustumCulled = false;
  coil.add(figures);
  const slots = Array.from({ length: count }, () => {
    const t = 0.06 + random() * 0.92;
    const around = (random() * 1.5 - 0.25) * Math.PI;
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
  const shade = new Color();
  const palette = greys.map((grey) => grey.clone());
  const pale = new Color("#d9d2ff");
  const warm = new Color("#ffc65e");
  const end = new Vector3();
  const facing = new Vector3();
  const origin = new Vector3();
  // How far awake the body was last laid out and the figures last placed, and the gold last painted (-1: not yet).
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
  const paint = (gold: number): void => {
    painted = gold;
    // Healed from the tail (the first row) up to how far the moment has come; each end takes the colour of its row.
    const reach = gold * 1.07;
    tones.forEach((tone, index) => {
      const row =
        index < rows * sides
          ? Math.floor(index / sides)
          : index === rows * sides
            ? 0
            : rows - 1;
      shade
        .copy(greys[tone] ?? shade)
        .lerp(
          golds[tone] ?? shade,
          1 - smooth(reach - 0.06, reach, row / rows),
        );
      shades.setXYZ(index, shade.r, shade.g, shade.b);
    });
    shades.needsUpdate = true;
    slots.forEach((slot, index) => {
      figures.setColorAt(index, slot.t < gold ? warm : pale);
    });
    if (figures.instanceColor !== null)
      figures.instanceColor.needsUpdate = true;
    palette.forEach((tone, index) => {
      tone
        .copy(greys[index] ?? tone)
        .lerp(golds[index] ?? tone, smooth(0.9, 1, gold));
    });
  };
  return {
    group,
    update(wake, gold, release, time, vision) {
      // Gone once the last of them has risen out of it.
      group.visible = release < 4;
      if (!group.visible) return;
      const fade = smooth(0, 1.6, release);
      // Asleep it breathes, slow and deep; awake it holds its breath.
      const breath = Math.sin(time * 0.55) * (1 - wake);
      coil.scale.set(1 + breath * 0.012, 1 + breath * 0.02, 1 + breath * 0.012);
      if (Math.abs(wake - built) > 0.002) layOut(wake);
      if (Math.abs(gold - painted) > 0.005) paint(gold);
      skin.emissiveIntensity = 0.1 + gold * 1.4 + fade;
      skin.opacity = 1 - fade;
      body.visible = fade < 0.999;
      ink.visible = fade < 0.2;
      // The head rides the end of the neck: level on the coil asleep, looking down at the family awake.
      const last = rows - 1;
      end.copy(rest[last] ?? end).lerp(risen[last] ?? end, wake);
      end.y += Math.sin(time) * 0.08 * wake;
      head.made.position.copy(end);
      facing
        .set(Math.sin(time * 0.4) * 0.14 * wake, -0.08 - 0.52 * wake, 1)
        .normalize();
      head.made.quaternion.setFromRotationMatrix(
        matrix.lookAt(facing, origin, spinAxis),
      );
      head.made.scale.setScalar(1 - fade);
      head.made.visible = fade < 0.999;
      head.update(wake, palette);
      // Savage Vision shows who is curled up inside it; healed, they glow through; let go, they light up and rise.
      const seen = vision ? 0.55 + Math.sin(time * 2.2) * 0.12 : 0;
      const going = smooth(0, 1.2, release);
      light.opacity = Math.max(seen, gold * 0.22, going * 0.9);
      figures.visible = light.opacity > 0.01;
      // The figures lie still while it sleeps; they are placed again only while it wakes, sways awake, or lets them go.
      if (!figures.visible) return;
      if (laid >= 0 && wake < 0.001 && laid < 0.001 && release === 0) return;
      laid = wake;
      slots.forEach((slot, index) => {
        here.copy(slot.rest).lerp(slot.awake, wake);
        // Let go, the tail first: each rises out of the body, home.
        const rising = smooth(slot.t * 0.5, slot.t * 0.5 + 1.5, release);
        here.y += rising * 7;
        size.setScalar(
          1 - smooth(slot.t * 0.5 + 1, slot.t * 0.5 + 2.6, release),
        );
        turn.setFromAxisAngle(spinAxis, slot.spin + time * 0.2 * wake);
        matrix.compose(here, turn, size);
        figures.setMatrixAt(index, matrix);
      });
      figures.instanceMatrix.needsUpdate = true;
    },
  };
}
