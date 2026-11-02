import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  type Group,
} from "three";

import { baseWidth, defu, hallRows } from "../rules/woods/base-map.ts";
import { colour } from "../screen/palette.ts";
import { group, paint, part, shapes } from "./parts.ts";

// What DeFu's weapons and the end of the woods look like in three dimensions: her laser (a thin red line while it glows, a white-hot beam
// while it burns), her shockwave (a square ring of pink light spreading out from her platform), confetti and sparkles over the defused
// rocket, and smoke when it leaves.
const glowing = (fill: string, opacity: number): MeshBasicMaterial =>
  new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: new Color(fill),
    depthWrite: false,
    opacity,
    transparent: true,
  });

export interface Laser {
  readonly core: Mesh;
  readonly halo: Mesh;
  readonly root: Group;
}

export function makeLaser(): Laser {
  const core = new Mesh(shapes.block, glowing(colour.fireHot, 0.95));
  const halo = new Mesh(shapes.block, glowing(colour.berry, 0.5));
  const root = group([core, halo]);
  root.visible = false;
  return { core, halo, root };
}

// The beam along a row (or column) of the hall: `phase` is null (no beam), "glow" or "burn".
export function setLaser(
  laser: Laser,
  line: { readonly horizontal: boolean; readonly line: number } | null,
  phase: "burn" | "glow" | null,
  time: number,
): void {
  laser.root.visible = line !== null && phase !== null;
  if (line === null || phase === null) return;
  const burning = phase === "burn";
  const thick = burning ? 0.22 + Math.sin(time * 40) * 0.03 : 0.04;
  const long = line.horizontal ? baseWidth - 2 : hallRows;
  laser.root.position.set(
    line.horizontal ? baseWidth / 2 : line.line + 0.5,
    0.55,
    line.horizontal ? line.line + 0.5 : 1 + hallRows / 2,
  );
  const shape = (scale: number): [number, number, number] =>
    line.horizontal
      ? [long, thick * scale, thick * scale]
      : [thick * scale, thick * scale, long];
  laser.core.scale.set(...shape(1));
  laser.halo.scale.set(...shape(burning ? 2.6 : 4));
  laser.core.visible = burning;
  const halo = laser.halo.material;
  if (halo instanceof MeshBasicMaterial)
    halo.opacity = burning ? 0.55 : 0.3 + Math.abs(Math.sin(time * 10)) * 0.4;
}

export interface Wave {
  readonly edges: readonly Mesh[];
  readonly glow: Mesh;
  readonly root: Group;
}

export function makeWave(): Wave {
  const fill = glowing(colour.pink, 0.75);
  const edges = [0, 1, 2, 3].map(() => new Mesh(shapes.block, fill));
  const glow = part(shapes.ring, glowing(colour.lavender, 0.8), {
    turn: [Math.PI / 2, 0, 0],
  });
  return { edges, glow, root: group([...edges, glow]) };
}

// The ring at `radius` tiles from DeFu (0: gathering under her platform; null: none), cut off at the end of the hall.
export function setWave(wave: Wave, radius: number | null, time: number): void {
  wave.root.visible = radius !== null;
  if (radius === null) return;
  wave.glow.visible = radius === 0;
  wave.glow.position.set(defu.x + 0.5, 0.45, defu.y + 0.5);
  wave.glow.scale.setScalar(0.6 + Math.abs(Math.sin(time * 12)) * 0.5);
  const west = defu.x - radius;
  const east = defu.x + radius + 1;
  const north = Math.max(1, defu.y - radius);
  const south = Math.min(hallRows + 1, defu.y + radius + 1);
  const band = 0.35;
  const [top, bottom, left, right] = wave.edges;
  const place = (
    edge: Mesh | undefined,
    show: boolean,
    x: number,
    z: number,
    wide: number,
    deep: number,
  ): void => {
    if (edge === undefined) return;
    edge.visible = radius > 0 && show;
    edge.position.set(x, 0.15, z);
    edge.scale.set(wide, 0.18, deep);
  };
  place(
    top,
    defu.y - radius >= 1,
    (west + east) / 2,
    defu.y - radius + 0.5,
    east - west,
    band,
  );
  place(
    bottom,
    defu.y + radius <= hallRows,
    (west + east) / 2,
    defu.y + radius + 0.5,
    east - west,
    band,
  );
  place(left, true, west + 0.5, (north + south) / 2, band, south - north);
  place(right, true, east - 0.5, (north + south) / 2, band, south - north);
}

const confettiCount = 240;

export interface Party {
  readonly confetti: Points;
  readonly smoke: readonly Mesh[];
}

export function makeParty(): Party {
  const places = new Float32Array(confettiCount * 3);
  const colours = new Float32Array(confettiCount * 3);
  const fills = [
    colour.gold,
    colour.mint,
    colour.pink,
    colour.cyan,
    colour.lavender,
  ].map((fill) => new Color(fill));
  for (let at = 0; at < confettiCount; at += 1) {
    const fill = fills[at % fills.length] ?? new Color(colour.gold);
    colours.set([fill.r, fill.g, fill.b], at * 3);
  }
  const shape = new BufferGeometry();
  shape.setAttribute("position", new BufferAttribute(places, 3));
  shape.setAttribute("color", new BufferAttribute(colours, 3));
  const confetti = new Points(
    shape,
    new PointsMaterial({ size: 0.12, vertexColors: true }),
  );
  confetti.visible = false;
  confetti.frustumCulled = false;
  const smoke = Array.from({ length: 10 }, () =>
    part(shapes.rock, paint("#b8b2cc", { opacity: 0.55 })),
  );
  for (const puff of smoke) puff.visible = false;
  return { confetti, smoke };
}

// Confetti falling and swirling round a point while `share` (of the scene) runs, or none for null.
export function setConfetti(
  party: Party,
  around: readonly [number, number, number],
  share: number | null,
): void {
  party.confetti.visible = share !== null;
  if (share === null) return;
  const places = party.confetti.geometry.getAttribute("position");
  for (let at = 0; at < confettiCount; at += 1) {
    const angle = at * 2.39996 + share * 6;
    const reach = 0.5 + ((at * 37) % 100) / 22;
    const fall = (((at * 53) % 100) / 100 + share * 1.6) % 1;
    places.setXYZ(
      at,
      around[0] + Math.cos(angle) * reach,
      around[1] + 4.5 - fall * 4.5,
      around[2] + Math.sin(angle) * reach,
    );
  }
  places.needsUpdate = true;
}

// Smoke billowing out from the rocket's foot as it leaves (`share` of the scene), or none for null.
export function setSmoke(
  party: Party,
  around: readonly [number, number, number],
  share: number | null,
): void {
  party.smoke.forEach((puff, at) => {
    puff.visible = share !== null;
    if (share === null) return;
    const angle = (at / party.smoke.length) * Math.PI * 2;
    const spread = 0.4 + share * 2.2 + (at % 3) * 0.2;
    puff.position.set(
      around[0] + Math.cos(angle) * spread,
      around[1] + 0.2 + (at % 2) * 0.3,
      around[2] + Math.sin(angle) * spread,
    );
    puff.scale.setScalar(0.25 + share * 0.6);
  });
}
