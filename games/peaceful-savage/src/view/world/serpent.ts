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
  type MeshToonMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { taperedTube } from "../body/tube.ts";
import { noise, texture } from "../palette.ts";
import { inkMaterial, toon } from "../toon.ts";
import { groundAt } from "./meadow.ts";

// The giant sly snake on the hill, made of every feeling the bloodline was told to put away: a great body coiled round the hilltop and
// rising in an S to a head that looks down at the family with heavy, sorrowful eyes (no fangs, nothing to fear: it is grief, not
// menace), and all along it the small curled figures of the ancestors trapped in it. It grows out of the grass from the tail up as the
// finale begins, and as the family works the moment through it warms to gold from the tail up. When the tree is lit it lets them go:
// the body fades, and the ancestors light up gold and rise out of it, home (they come to the tree in the hall: see ancestors.ts).
export interface Serpent {
  readonly group: Group;
  // `rise` 0 to 1 as it gathers, `gold` 0 to 1 as it is healed, and the seconds since the tree was lit (0 before).
  update(rise: number, gold: number, release: number, time: number): void;
}

const centre = new Vector3(0, groundAt(0, -18), -18);
const rows = 140;
const sides = 14;

// Coiled once and a half round the hilltop, then up in an S toward the house, where the family comes from.
function path(): CatmullRomCurve3 {
  const points: Vector3[] = [];
  for (let at = 0; at <= 16; at += 1) {
    const t = at / 16;
    const angle = Math.PI * 0.5 + t * Math.PI * 3;
    const radius = 4.2 - t * 1.6;
    points.push(
      new Vector3(
        Math.cos(angle) * radius,
        0.45 + t * 1.2,
        Math.sin(angle) * radius,
      ),
    );
  }
  points.push(
    new Vector3(-1.2, 1.6, 2.4),
    new Vector3(0.6, 3.2, 2.2),
    new Vector3(0.2, 4.6, 1.2),
    new Vector3(0, 5.3, 2.4),
  );
  return new CatmullRomCurve3(points.map((point) => point.add(centre)));
}

const smooth = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// Thick through the coil, fine at the tail, a little narrower at the neck.
const girth = (t: number): number =>
  0.12 + 0.68 * smooth(0, 0.3, t) - 0.18 * smooth(0.82, 1, t);

// Scales: rows of overlapping half-circles, each edged in a fine line that glows gold once healed.
function scales() {
  return texture(
    64,
    (x, y) => {
      const row = Math.floor(y / 16);
      const shift = row % 2 === 0 ? 0 : 8;
      const cx = Math.floor((x + shift) / 16) * 16 + 8 - shift;
      const d = Math.hypot(x - cx, (y % 16) - 2);
      const edge = Math.abs(d - 9) < 1.1;
      return edge ? [255, 215, 120, 255] : [0, 0, 0, 255];
    },
    1,
  );
}

function head(skin: MeshToonMaterial): Group {
  const made = new Group();
  const skull = new Mesh(new SphereGeometry(1, 28, 18), skin);
  skull.scale.set(0.95, 0.62, 1.35);
  const snout = new Mesh(new SphereGeometry(1, 24, 14), skin);
  snout.scale.set(0.7, 0.42, 0.7);
  snout.position.set(0, -0.12, 0.95);
  made.add(skull, snout);
  for (const s of [1, -1]) {
    const eye = new Mesh(
      new SphereGeometry(0.24, 16, 12),
      new MeshStandardMaterial({ color: "#f4eedf", roughness: 0.35 }),
    );
    eye.position.set(s * 0.55, 0.22, 0.78);
    const iris = new Mesh(
      new SphereGeometry(0.13, 12, 10),
      new MeshStandardMaterial({ color: "#5a4a7a", roughness: 0.2 }),
    );
    iris.position.set(s * 0.02, -0.04, 0.16);
    eye.add(iris);
    // A heavy upper lid, half shut and tipped down at the outer corner: sorrowful, not fierce.
    const lid = new Mesh(
      new SphereGeometry(0.27, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      skin,
    );
    lid.position.copy(eye.position);
    lid.rotation.set(0.75, 0, s * -0.35);
    const brow = new Mesh(new TorusGeometry(0.22, 0.04, 6, 16, Math.PI), skin);
    brow.position.set(s * 0.55, 0.47, 0.82);
    brow.rotation.set(0, 0, s * 0.3);
    made.add(eye, lid, brow);
  }
  return made;
}

export function buildSerpent(count: number): Serpent {
  const random = noise(2_027);
  const group = new Group();
  const curve = path();
  const spine = curve.getSpacedPoints(rows - 1);
  const shape = taperedTube(spine, { radius: girth, sides });
  const shades = new Float32Array(shape.getAttribute("position").count * 3);
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
  group.add(body);
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
  group.add(face);
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
  group.add(figures);
  const along = new Vector3();
  const slots = Array.from({ length: count }, () => {
    const t = random();
    const around = random() * Math.PI * 2;
    const start = new Vector3(
      (random() - 0.5) * 22,
      0,
      -18 + (random() - 0.5) * 16,
    );
    start.y = groundAt(start.x, start.z);
    return { around, spin: random() * Math.PI * 2, start, t };
  });
  const matrix = new Matrix4();
  const spinAxis = new Vector3(0, 1, 0);
  const grey = new Color("#8f8ea8");
  const golden = new Color("#f0b84c");
  const shade = new Color();
  const indexCount = shape.getIndex()?.count ?? 0;
  let painted = -1;
  return {
    group,
    update(rise, gold, release, time) {
      // Gone once the last of them has risen out of it.
      group.visible = rise > 0.001 && release < 2.5;
      if (!group.visible) return;
      const fade = smooth(0, 1.6, release);
      // It grows out of the grass from the tail; the head comes last.
      const shown = Math.min(1, rise * 1.15);
      shape.setDrawRange(0, Math.floor((indexCount * shown) / 6) * 6);
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
        const colours = shape.getAttribute("color");
        colours.needsUpdate = true;
      }
      skin.emissiveIntensity = 0.1 + gold * 1.4 + fade;
      skin.opacity = 1 - fade;
      body.visible = fade < 0.999;
      headSkin.color.copy(grey).lerp(golden, smooth(0.9, 1, gold));
      headSkin.emissiveIntensity = skin.emissiveIntensity;
      headSkin.opacity = skin.opacity;
      ink.visible = fade < 0.2;
      // The ancestors light up as they are let go.
      figureSkin.emissiveIntensity = gold * 0.8 + smooth(0, 1.2, release) * 0.6;
      curve.getPointAt(1, along);
      face.position.copy(along).add(new Vector3(0, Math.sin(time) * 0.08, 0.5));
      face.scale.setScalar(smooth(0.82, 1, rise) * (1 - fade));
      face.rotation.set(
        0.35 + Math.sin(time * 0.5) * 0.05,
        Math.sin(time * 0.4) * 0.2,
        0,
      );
      slots.forEach((slot, index) => {
        curve.getPointAt(slot.t, along);
        const r = girth(slot.t) + 0.03;
        along.x += Math.cos(slot.around) * r;
        along.y += Math.sin(slot.around) * r;
        const settled = smooth(slot.t * 0.6, slot.t * 0.6 + 0.4, rise);
        const here = slot.start.clone().lerp(along, settled);
        here.y += Math.sin(time * 1.5 + slot.t * 12) * 0.03;
        // Let go, the tail first: each lights up and rises out of the body, home.
        const going = smooth(slot.t * 0.5, slot.t * 0.5 + 1.5, release);
        here.y += going * 6;
        const scale = settled * (1 - going);
        matrix.compose(
          here,
          new Quaternion().setFromAxisAngle(spinAxis, slot.spin + time * 0.2),
          new Vector3(scale, scale, scale),
        );
        figures.setMatrixAt(index, matrix);
        figures.setColorAt(index, slot.t < gold ? golden : grey);
      });
      figures.instanceMatrix.needsUpdate = true;
      if (figures.instanceColor !== null)
        figures.instanceColor.needsUpdate = true;
    },
  };
}
