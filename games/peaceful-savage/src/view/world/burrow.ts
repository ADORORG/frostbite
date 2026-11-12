import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from "three";

import { places } from "../../rules/layout.ts";
import { painted, softGlow, type Tone } from "../palette.ts";
import { inked, toon } from "../toon.ts";
import { groundAt } from "./meadow.ts";
import { metres } from "./rooms.ts";

// The giant snake, before anyone has seen it: it moves under the meadow. A ridge of turned earth runs along over it wherever it goes,
// settling behind it; from time to time a loop of its grey back rolls up out of the grass and slides under again, never its head; and
// on the hill, where it rests, the earth is heaped in a great mound that breathes. It is seen whole only at the end, when the family
// comes to the hill in their jackets and it rises out of the mound (see serpent.ts). All of this is only seen: the rules know the hill
// and what stands on it, and nothing else of the snake.
export interface Burrow {
  readonly group: Group;
  // `under` is whether the snake is still under the ground, `up` how far it has risen out of the mound (0 to 1), and `vision` whether
  // Savage Vision is open (which shows a light where it is).
  update(under: boolean, up: number, time: number, vision: boolean): void;
}

const hill = { x: metres(places.hill.x), z: metres(places.hill.z) };
// The mound over where it rests: as wide as what the rules keep a body out of.
export const mound = { deep: 5, high: 2, wide: 4.5, z: hill.z + 0.1 };
const underMound = (x: number, z: number): boolean =>
  Math.hypot((x - hill.x) / mound.wide, (z - mound.z) / mound.deep) < 1.05;

// Where it is on its way round the meadow, `along` in radians: a wide figure of eight that passes under the hill.
export function burrowAt(along: number): Vector3 {
  const x = hill.x + 12 * Math.sin(along);
  const z = -13.5 - 7.65 * Math.sin(2 * along + 0.5);
  return new Vector3(x, groundAt(x, z), z);
}
// How fast it goes round, in radians a second (about a walking pace), and how often and for how long its back shows.
const pace = 0.12;
export const breach = { every: 13, lasts: 4.2 };
// How far out of the ground its back is (0 to 1) at a time.
export function breachAt(time: number): number {
  const since = ((time % breach.every) + breach.every) % breach.every;
  return since < breach.lasts
    ? Math.sin((Math.PI * since) / breach.lasts) ** 0.8
    : 0;
}

const clods = 44;

export function buildBurrow(tone: Tone): Burrow {
  const group = new Group();
  group.name = "burrow";
  const earth = painted(tone, { color: "#6b4a32" });
  const ridge = new InstancedMesh(new SphereGeometry(1, 10, 8), earth, clods);
  ridge.frustumCulled = false;
  ridge.receiveShadow = true;
  // The loop of its back: an arch of grey, inked round like everything alive here.
  const back = new Mesh(
    new TorusGeometry(1.5, 0.46, 10, 28, Math.PI),
    toon(tone, { color: "#a9a7bf", rim: 0.25 }),
  );
  back.castShadow = true;
  inked(back, 0.02);
  // The mound: a heap of turned earth, lumpy, with the grass torn round it.
  const heap = new SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const position = heap.getAttribute("position");
  for (let at = 0; at < position.count; at += 1) {
    const [x, y, z] = [position.getX(at), position.getY(at), position.getZ(at)];
    const lump = 1 + 0.07 * Math.sin(x * 9 + z * 5) * Math.cos(z * 8 - x * 3);
    position.setXYZ(at, x * lump, y ** 1.25 * lump, z * lump);
  }
  heap.computeVertexNormals();
  const pile = new Mesh(heap, earth);
  pile.position.set(hill.x, groundAt(hill.x, mound.z) - 0.05, mound.z);
  pile.castShadow = true;
  pile.receiveShadow = true;
  const light = new Sprite(
    new SpriteMaterial({
      color: "#cfc8ff",
      depthTest: false,
      map: softGlow(),
      opacity: 0,
      transparent: true,
    }),
  );
  light.scale.setScalar(3);
  group.add(ridge, back, pile, light);
  const matrix = new Matrix4();
  const still = new Quaternion();
  const size = new Vector3();
  return {
    group,
    update(under, up, time, vision) {
      // The mound breathes, slow and deep, and falls away as the snake comes up through it.
      const breath = 1 + Math.sin(time * 0.55) * 0.03;
      pile.visible = up < 0.98;
      pile.scale.set(mound.wide, mound.high * breath * (1 - up), mound.deep);
      ridge.visible = under;
      back.visible = false;
      light.material.opacity = 0;
      if (!under) return;
      const along = time * pace;
      for (let clod = 0; clod < clods; clod += 1) {
        const at = burrowAt(along - clod * 0.014);
        const age = clod / clods;
        // Thrown up at its nose, highest just behind it, settling flat along the tail of the ridge.
        const swell =
          Math.sin(Math.PI * Math.min(1, (clod + 1) / 5) * 0.5) *
          (1 - age) ** 1.3;
        const shown = underMound(at.x, at.z) ? 0 : 1;
        size.set(0.62, 0.06 + 0.4 * swell, 0.62).multiplyScalar(shown);
        matrix.compose(at.setY(at.y - 0.03), still, size);
        ridge.setMatrixAt(clod, matrix);
      }
      ridge.instanceMatrix.needsUpdate = true;
      const here = burrowAt(along - 0.1);
      const ahead = burrowAt(along - 0.05);
      const out = underMound(here.x, here.z) ? 0 : breachAt(time);
      back.visible = out > 0.01;
      back.position.set(here.x, here.y - 1.96 + out * 1.5, here.z);
      back.rotation.y = Math.atan2(-(ahead.z - here.z), ahead.x - here.x);
      if (vision) {
        light.material.opacity = 0.5 + Math.sin(time * 2.2) * 0.12;
        light.position.set(ahead.x, ahead.y + 0.4, ahead.z);
      }
    },
  };
}
