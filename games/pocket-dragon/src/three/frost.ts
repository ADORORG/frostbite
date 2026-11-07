import { Color, type Mesh, type MeshStandardMaterial, type Scene } from "three";

import type { Base, WoodsState } from "../rules/woods/types.ts";
import { visionOn } from "../rules/woods/vision.ts";
import { futuresOf } from "../screen/frost-futures.ts";
import { outcomeColours } from "../screen/frost-look.ts";
import { colour } from "../screen/palette.ts";
import { ownPaint, paint, part, shapes } from "./parts.ts";

// Flying and frost vision in three dimensions. Glitchy (and the dragons behind it) rise to the height it flies at, over a shadow on the
// ground. While frost vision lasts, the night turns icy blue and each of the three futures is a line of glowing stepping stones at
// Glitchy's height with a gem where it ends: ice for safe, gold for a find, red for a bump.
export const flightHeights = [0, 0.9, 2.6] as const;
const longest = 14;

interface Trail {
  readonly end: Mesh;
  readonly marks: readonly Mesh[];
  readonly paint: MeshStandardMaterial;
}
export interface Frost {
  readonly shadow: Mesh;
  readonly trails: readonly Trail[];
}

export function makeFrost(scene: Scene): Frost {
  const trails = [0, 1, 2].map((): Trail => {
    const glow = ownPaint(colour.ice, {
      glow: colour.ice,
      glowing: 0.9,
      opacity: 0.75,
    });
    const marks = Array.from({ length: longest }, () =>
      part(shapes.cylinder, glow, { size: [0.14, 0.03, 0.14] }),
    );
    const end = part(shapes.gem, glow, { size: 0.15 });
    for (const mark of [...marks, end]) {
      mark.visible = false;
      mark.castShadow = false;
    }
    scene.add(...marks, end);
    return { end, marks, paint: glow };
  });
  const shadow = part(shapes.cylinder, paint("#000000", { opacity: 0.3 }), {
    size: [0.32, 0.01, 0.32],
  });
  shadow.castShadow = false;
  shadow.visible = false;
  scene.add(shadow);
  return { shadow, trails };
}

const night = new Color("#1a0e3d");
const icy = new Color("#23507c");

export function showFrost(
  frost: Frost,
  scene: Scene,
  state: WoodsState,
  base: Base,
  glitchy: readonly [number, number, number],
  dt: number,
): void {
  const futures = futuresOf(state);
  const height = flightHeights[base.altitude] + 0.06;
  frost.trails.forEach((trail, at) => {
    const future = futures[at];
    trail.marks.forEach((mark, step) => {
      const spot = future?.path[step];
      mark.visible = spot !== undefined;
      if (spot !== undefined)
        mark.position.set(spot.x + 0.5, height, spot.y + 0.5);
    });
    const last = future?.path[future.path.length - 1];
    trail.end.visible = last !== undefined;
    if (future === undefined || last === undefined) return;
    const fill = outcomeColours[future.end];
    trail.paint.color.set(fill);
    trail.paint.emissive.set(fill);
    trail.end.position.set(last.x + 0.5, height + 0.4, last.y + 0.5);
    trail.end.rotation.y = state.tick / 20;
  });
  frost.shadow.visible = glitchy[1] > 0.05;
  frost.shadow.position.set(glitchy[0], 0.02, glitchy[2]);
  const share = 1 - Math.exp(-dt * 4);
  const target = visionOn(base, state.tick) ? icy : night;
  if (scene.background instanceof Color) scene.background.lerp(target, share);
  scene.fog?.color.lerp(target, share);
}
