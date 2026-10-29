import {
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  sprite,
  stars,
  type Scene,
} from "../engine/index.ts";

// Retro racer: a road in perspective under a striped sun, with a car swaying along it. The road bends once a loop, the stripes run at a
// speed that divides the loop, and the car's sway fits it five times, so the loop closes.
const car = [
  "...######...",
  "..########..",
  ".##########.",
  "############",
  "#.##....##.#",
  "####....####",
] as const;
const loopSeconds = 20;
const horizon = 40;
const stripeRate = 6;
// Offsets the stripes so none changes exactly on the moment the loop closes.
const stripePhase = 0.37;
const bend = 38;
const swayCycles = 4;
const swayAmount = 16;
const depth = 14;
const roadSlope = 1.5;
const roadFloor = 3;
const curbWidth = 3;
const reach = 52;

export const racer: Scene = {
  id: "racer",
  make: () => ({
    draw: (surface, t) => {
      rect(surface, 0, 0, sceneWidth, horizon, palette.deep);
      rect(surface, 0, 20, sceneWidth, 20, palette.dusk);
      rect(surface, 62, 14, 36, 26, palette.pink);
      for (const [y, height] of [
        [26, 1],
        [31, 2],
        [36, 3],
      ] as const)
        rect(surface, 62, y, 36, height, palette.dusk);
      stars(surface, 6, 24, 16);
      for (let peak = 0; peak < 6; peak += 1)
        for (let line = 0; line < 14; line += 1)
          rect(
            surface,
            peak * 30 - 10 + line,
            horizon - 14 + line,
            Math.max(0, 30 - line * 2),
            1,
            palette.nearCity,
          );
      const curve = Math.sin((t / loopSeconds) * Math.PI * 2) * bend;
      for (let y = horizon; y < sceneHeight; y += 1) {
        const row = y - horizon + 1;
        const striped =
          Math.floor(depth / row + t * stripeRate + stripePhase) % 2 === 0;
        const half = row * roadSlope + roadFloor;
        const centre =
          sceneWidth / 2 + curve * (1 - row / reach) * (1 - row / reach);
        rect(
          surface,
          0,
          y,
          sceneWidth,
          1,
          striped ? palette.turf : palette.turfAlt,
        );
        rect(
          surface,
          centre - half - curbWidth,
          y,
          half * 2 + curbWidth * 2,
          1,
          striped ? palette.red : palette.white,
        );
        rect(
          surface,
          centre - half,
          y,
          half * 2,
          1,
          striped ? palette.road : palette.roadAlt,
        );
        if (striped) rect(surface, centre - 0.5, y, 1, 1, palette.white);
      }
      const sway =
        Math.sin((t / loopSeconds) * Math.PI * 2 * swayCycles) * swayAmount;
      sprite(surface, car, 74 + sway, 78, palette.yellow);
      rect(surface, 75 + sway, 77, 2, 1, palette.red);
      rect(surface, 83 + sway, 77, 2, 1, palette.red);
    },
    loopSeconds,
  }),
  name: "Retro racer",
};
