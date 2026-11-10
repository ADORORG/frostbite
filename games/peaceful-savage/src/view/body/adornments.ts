import {
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshToonMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import type { HeroId } from "../../rules/constants.ts";
import { glowing } from "../palette.ts";
import { ramp } from "../toon.ts";
import { taperedTube } from "./tube.ts";

// The family's gold: Mama's headband with its feather and her feather earrings, Zora's hair beads and her little feathers, Daddy's gold
// earring. Gold is the magic coming back, so it glows a little and is never greyed.

// A feather: a slim cream vane warming to peach and then tan toward its tip, on a gold shaft.
let vane: MeshToonMaterial | null = null;
function featherPaint(): MeshToonMaterial {
  vane ??= new MeshToonMaterial({
    color: "#ffffff",
    emissive: "#4a3420",
    emissiveIntensity: 0.35,
    gradientMap: ramp(true),
    vertexColors: true,
  });
  return vane;
}

function feather(length: number, glow: number): Mesh {
  const points = Array.from({ length: 12 }, (_, at) => {
    const t = at / 11;
    return new Vector3(Math.sin(t * 1.4) * length * 0.08, t * length, 0);
  });
  const geometry = taperedTube(points, {
    across: 0.18,
    radius: (t) =>
      length * 0.095 * Math.sin(Math.min(1, t * 1.1) * Math.PI) ** 0.7,
    sides: 10,
    up: new Vector3(1, 0, 0),
  });
  const uv = geometry.getAttribute("uv");
  const cream = new Color("#f7ead6");
  const peach = new Color("#f0b98a");
  const tan = new Color("#9c6a3e");
  const colours: number[] = [];
  for (let index = 0; index < uv.count; index += 1) {
    const t = uv.getY(index) / length;
    const colour = cream
      .clone()
      .lerp(peach, Math.min(1, t * 1.6))
      .lerp(tan, Math.max(0, t - 0.7) * 3);
    colours.push(colour.r, colour.g, colour.b);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  const plume = new Mesh(geometry, featherPaint());
  const shaft = new Mesh(
    taperedTube(points, {
      radius: (t) => length * 0.012 * (1 - t * 0.7),
      sides: 5,
    }),
    glowing("#f2bf4a", glow),
  );
  plume.add(shaft);
  return plume;
}

// Mama's gold headband round her brow (an oval, as her head is, `wide` across and `deep` front to back), a jewel at its centre and a tall
// feather standing from it with two smaller ones beside.
export function headband(
  head: Object3D,
  r: number,
  band: { readonly at: Vector3; readonly deep: number; readonly wide: number },
): void {
  const ring = new Mesh(
    new TorusGeometry(1, 0.055, 8, 56),
    glowing("#e6b34c", 0.9),
  );
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(band.wide, band.deep, r);
  const holder = new Object3D();
  holder.position.copy(band.at);
  holder.rotation.x = -0.22;
  holder.add(ring);
  head.add(holder);
  const jewel = new Mesh(
    new SphereGeometry(r * 0.09, 12, 8),
    glowing("#2fd3c4", 1.2),
  );
  jewel.position.set(0, r * 0.02, band.deep * 1.02);
  holder.add(jewel);
  for (const [lean, size] of [
    [0, 1.35],
    [0.32, 0.8],
    [-0.3, 0.75],
  ] as const) {
    const plume = feather(r * 1.25 * size, 0.6);
    plume.position.set(lean * r * 0.32, r * 0.1, band.deep * 0.98);
    plume.rotation.set(0.32, 0, -lean);
    holder.add(plume);
  }
}

// Zora's gold beads round the base of each puff.
export function beads(puff: Object3D, r: number, side: number): void {
  for (let bead = 0; bead < 4; bead += 1) {
    const ball = new Mesh(
      new SphereGeometry(r * 0.07, 10, 8),
      glowing("#f5c04a", 0.8),
    );
    const around = (bead / 4) * Math.PI * 2;
    ball.position.set(
      -side * r * 0.35 + Math.cos(around) * r * 0.36,
      -r * 0.5,
      Math.sin(around) * r * 0.36,
    );
    puff.add(ball);
  }
}

// Earrings, as the cover has them: Mama's feathers with a gold gem, Zora's little feathers, Daddy's one gold hoop. Each hangs from the
// lobe of an ear (`ear` is the right ear in the head's own units, and its size).
export function earrings(
  head: Object3D,
  hero: HeroId,
  r: number,
  ear: { readonly at: Vector3; readonly size: number },
): void {
  if (hero === "kai") return;
  const lobe = (s: number) =>
    new Vector3(
      s * (Math.abs(ear.at.x) + 0.04) * r,
      (ear.at.y - ear.size * 0.72 + 0.88) * r,
      (ear.at.z + 0.04) * r + 0.005,
    );
  for (const s of hero === "ali" ? [1] : [1, -1]) {
    if (hero === "ali") {
      const hoop = new Mesh(
        new TorusGeometry(r * 0.085, r * 0.018, 6, 24),
        glowing("#f2bf4a", 0.9),
      );
      hoop.position.copy(lobe(s)).add(new Vector3(0, -r * 0.06, 0));
      hoop.rotation.y = Math.PI / 2;
      head.add(hoop);
      continue;
    }
    const length = hero === "heerah" ? 0.55 : 0.36;
    const drop = feather(r * length, 0.4);
    drop.position.copy(lobe(s));
    drop.rotation.z = Math.PI;
    head.add(drop);
    const gem = new Mesh(
      new SphereGeometry(r * (hero === "heerah" ? 0.05 : 0.035), 8, 6),
      glowing("#ffcb57", 1.4),
    );
    gem.position.copy(lobe(s));
    head.add(gem);
  }
}
