import {
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  sprite,
  type Scene,
} from "../engine/index.ts";

// Bird hunt: birds cross a dusk sky and a crosshair finds each one. A bird that is hit stops flying and falls. Every bird repeats every
// seven seconds, so a loop of two of them closes with no seam.
const wings = [
  ["#.....#", ".#...#.", "..###..", "...#..."],
  ["..###..", ".#####.", "#..#..#", "...#..."],
] as const;
const cycleSeconds = 7;
const loopSeconds = cycleSeconds * 2;
const offsets = [0, 2.4, 4.7] as const;
const heights = [22, 34, 14] as const;
const hitAt = 0.62;
const fallEnds = 0.78;
const flapRate = 6;
// Wing beats are offset so none falls exactly on the moment the loop closes.
const flapPhase = 0.3;
const bobSpeed = 16;
const bobAmount = 4;
const fallPixels = 60;
const margin = 10;

interface Bird {
  readonly falling: boolean;
  readonly gone: boolean;
  readonly phase: number;
  readonly x: number;
  readonly y: number;
}

function bird(index: number, t: number): Bird {
  const phase = ((t + (offsets[index] ?? 0)) % cycleSeconds) / cycleSeconds;
  const base = heights[index] ?? 20;
  const flying = (at: number) => ({
    x: -margin + at * (sceneWidth + margin * 2),
    y: base + Math.sin(at * bobSpeed + index) * bobAmount,
  });
  if (phase >= hitAt && phase < fallEnds) {
    const drop = (phase - hitAt) / (fallEnds - hitAt);
    const at = flying(hitAt);
    return {
      falling: true,
      gone: false,
      phase,
      x: at.x,
      y: at.y + drop * drop * fallPixels,
    };
  }
  return { falling: false, gone: phase >= fallEnds, phase, ...flying(phase) };
}

export const birds: Scene = {
  id: "birds",
  make: () => ({
    draw: (surface, t) => {
      rect(surface, 0, 0, sceneWidth, 30, palette.deeper);
      rect(surface, 0, 30, sceneWidth, 20, palette.dusk);
      rect(surface, 0, 50, sceneWidth, 20, palette.duskGlow);
      rect(surface, 118, 44, 10, 10, palette.yellow);
      rect(surface, 116, 46, 14, 6, palette.yellow);
      for (let x = 0; x < sceneWidth; x += 2)
        rect(
          surface,
          x,
          66 -
            Math.abs(Math.sin(x * 0.06)) * 10 -
            Math.abs(Math.sin(x * 0.17)) * 3,
          2,
          30,
          palette.hill,
        );
      rect(surface, 0, 74, sceneWidth, sceneHeight - 74, palette.grass);
      // The crosshair follows the bird furthest along that is still in the air.
      let aim: Bird | null = null;
      for (let index = 0; index < offsets.length; index += 1) {
        const current = bird(index, t);
        if (current.gone) continue;
        sprite(
          surface,
          wings[
            current.falling
              ? 1
              : Math.floor(t * flapRate + index + flapPhase) % 2
          ] ?? wings[0],
          current.x,
          current.y,
          current.falling ? palette.red : palette.white,
        );
        if (aim === null || current.phase > aim.phase) aim = current;
      }
      if (aim === null) return;
      const x = Math.round(aim.x + 3);
      const y = Math.round(aim.y + 2);
      const hit = aim.phase >= hitAt && aim.phase < hitAt + 0.04;
      const colour = hit ? palette.yellow : palette.red;
      rect(surface, x - 6, y, 4, 1, colour);
      rect(surface, x + 3, y, 4, 1, colour);
      rect(surface, x, y - 6, 1, 4, colour);
      rect(surface, x, y + 3, 1, 4, colour);
      if (hit) rect(surface, x - 3, y - 3, 7, 7, palette.shine);
    },
    loopSeconds,
  }),
  name: "Bird hunt",
};
