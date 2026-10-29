import {
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  type Scene,
} from "../engine/index.ts";

// Snowfall over an icy range at night: the platform's own weather, kept out of the list a visitor can pick from because it is a
// background for the page, not a game. Three layers of flakes fall at speeds that are whole numbers of screens in the loop, so the snow
// never jumps, and sway on a whole number of cycles for the same reason.
const loopSeconds = 18;
type Layer = {
  readonly colour: string;
  readonly count: number;
  readonly size: number;
  readonly sway: number;
  readonly swayCycles: number;
  // Screens fallen in one loop: a whole number, which is what closes it.
  readonly screens: number;
};
const layers: readonly Layer[] = [
  {
    colour: palette.starDim,
    count: 44,
    screens: 1,
    size: 1,
    sway: 2,
    swayCycles: 1,
  },
  {
    colour: palette.starBright,
    count: 30,
    screens: 2,
    size: 1,
    sway: 3,
    swayCycles: 2,
  },
  {
    colour: palette.white,
    count: 16,
    screens: 3,
    size: 2,
    sway: 4,
    swayCycles: 3,
  },
];

// A repeatable scatter: the same flakes in the same places every time, with no random numbers to drift.
const scatter = (index: number, salt: number): number =>
  (((Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453) % 1) + 1) % 1;

// The range: columns two pixels wide, tallest at its peaks, lit along the top edge.
const ridge = (x: number): number =>
  26 + Math.abs(Math.sin(x / 19) * 16) + Math.abs(Math.sin(x / 7 + 1) * 5);

export const snowfall: Scene = {
  id: "snowfall",
  make: () => ({
    draw: (surface, t) => {
      rect(surface, 0, 0, sceneWidth, sceneHeight, palette.background);
      rect(surface, 0, 28, sceneWidth, 30, palette.night);
      rect(surface, 0, 52, sceneWidth, 38, palette.deep);
      for (let x = 0; x < sceneWidth; x += 2) {
        const top = sceneHeight - ridge(x);
        rect(surface, x, top, 2, sceneHeight - top, palette.ridge);
        rect(surface, x, top, 2, 1, palette.cloud);
      }
      layers.forEach(
        ({ colour, count, screens, size, sway, swayCycles }, layer) => {
          for (let flake = 0; flake < count; flake += 1) {
            const seed = layer * 100 + flake;
            const fallen = (screens * sceneHeight * t) / loopSeconds;
            const y = (scatter(seed, 1) * sceneHeight + fallen) % sceneHeight;
            const drift =
              Math.sin(
                ((t / loopSeconds) * swayCycles + scatter(seed, 3)) *
                  Math.PI *
                  2,
              ) * sway;
            const x =
              (((scatter(seed, 2) * sceneWidth + drift) % sceneWidth) +
                sceneWidth) %
              sceneWidth;
            rect(surface, x, y, size, size, colour);
          }
        },
      );
    },
    loopSeconds,
  }),
  name: "Snowfall",
};
