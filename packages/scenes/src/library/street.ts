import {
  palette,
  rect,
  scroll,
  sceneHeight,
  sceneWidth,
  seededRandom,
  sprite,
  stars,
  type Scene,
  type Surface,
} from "../engine/index.ts";

// Night street: a city in layers sliding past at different speeds, street lamps, a car now and then, and a figure in a long coat walking
// down the middle. The loop is 20 seconds and every scroll speed divides it into a whole number of its own repeats, so it closes.
const strides = [
  [
    "..##...",
    ".####..",
    "..##...",
    ".####..",
    "#.##.#.",
    "..##...",
    "..##...",
    ".#..#..",
    ".#..#..",
    "##..##.",
  ],
  [
    "..##...",
    ".####..",
    "..##...",
    ".####..",
    "#.##.#.",
    "..##...",
    "..##...",
    "..###..",
    "..#.#..",
    ".##.##.",
  ],
] as const;
const loopSeconds = 20;
const horizon = 66;
const strideRate = 5;
// Strides are offset so none changes exactly on the moment the loop closes.
const stridePhase = 0.3;
const walkerColumn = 70;
const carEvery = 10;
const farRepeat = 160;
const nearRepeat = 320;
const lampRepeat = 80;
const stripeRepeat = 20;

interface Block {
  readonly height: number;
  readonly lit: number;
  readonly width: number;
  readonly x: number;
}

function skyline(
  seed: number,
  span: number,
  low: number,
  high: number,
): readonly Block[] {
  const random = seededRandom(seed);
  const blocks: Block[] = [];
  for (let x = 0; x < span;) {
    const width = Math.min(14 + Math.floor(random() * 18), span - x);
    blocks.push({
      height: low + Math.floor(random() * (high - low)),
      lit: random(),
      width,
      x,
    });
    x += width;
  }
  return blocks;
}

function drawSkyline(
  surface: Surface,
  blocks: readonly Block[],
  span: number,
  speed: number,
  t: number,
  colour: string,
  base: number,
  windows: boolean,
) {
  const shift = scroll(t, speed, span);
  for (const repeat of [-1, 0, 1])
    for (const block of blocks) {
      const x = block.x - shift + repeat * span;
      rect(surface, x, base - block.height, block.width, block.height, colour);
      if (!windows) continue;
      // Which windows are lit belongs to the building, not to where it is on the screen, so they do not shimmer as it passes.
      for (let row = 0; base - block.height + 4 + row * 6 < base - 6; row += 1)
        for (
          let column = 0;
          x + 3 + column * 5 < x + block.width - 3;
          column += 1
        )
          if (Math.floor(block.lit * 1000 + row * 7 + column * 3) % 5 < 2)
            rect(
              surface,
              x + 3 + column * 5,
              base - block.height + 4 + row * 6,
              2,
              3,
              palette.yellow,
            );
    }
}

export const street: Scene = {
  id: "street",
  make: () => {
    const far = skyline(21, farRepeat, 20, 44);
    const near = skyline(5, nearRepeat, 26, 52);
    return {
      draw: (surface, t) => {
        rect(surface, 0, 0, sceneWidth, 60, palette.night);
        rect(surface, 0, 40, sceneWidth, 20, palette.deeper);
        rect(surface, 128, 8, 12, 12, palette.moon);
        rect(surface, 131, 8, 9, 10, palette.night);
        stars(surface, 4, 30, 30);
        drawSkyline(surface, far, farRepeat, 8, t, palette.farCity, 62, false);
        drawSkyline(
          surface,
          near,
          nearRepeat,
          16,
          t,
          palette.nearCity,
          horizon,
          true,
        );
        rect(
          surface,
          0,
          horizon,
          sceneWidth,
          sceneHeight - horizon,
          palette.asphalt,
        );
        rect(surface, 0, horizon, sceneWidth, 1, palette.purple);
        for (
          let x = -scroll(t, 55, stripeRepeat);
          x < sceneWidth;
          x += stripeRepeat
        )
          rect(surface, x, 80, 10, 1, palette.deeper);
        for (let repeat = -1; repeat <= 2; repeat += 1) {
          const x = repeat * lampRepeat - scroll(t, 40, lampRepeat) + 30;
          rect(surface, x, 44, 1, 22, palette.starDim);
          rect(surface, x - 3, 43, 7, 2, palette.starDim);
          rect(surface, x - 2, 45, 5, 2, palette.yellow);
        }
        const along = (t % carEvery) / carEvery;
        // The car crosses from the right in the first half of each ten seconds and is out of sight for the second.
        const x = sceneWidth + 10 - along * 2 * (sceneWidth + 50);
        rect(surface, x, 72, 22, 6, palette.red);
        rect(surface, x + 4, 68, 12, 5, palette.red);
        rect(surface, x + 5, 69, 10, 3, palette.cyan);
        rect(surface, x - 3, 74, 3, 2, palette.yellow);
        rect(surface, x + 2, 77, 4, 3, palette.background);
        rect(surface, x + 15, 77, 4, 3, palette.background);
        // The figure: a long coat, a hat and a face, its feet alternating.
        const stride = Math.floor(t * strideRate + stridePhase) % 2;
        const bob = stride === 0 ? 0 : -1;
        sprite(
          surface,
          strides[stride] ?? strides[0],
          walkerColumn,
          horizon + bob,
          palette.coat,
        );
        sprite(
          surface,
          ["..###..", ".#####."],
          walkerColumn,
          horizon - 2 + bob,
          palette.ridge,
        );
        sprite(
          surface,
          ["..##...", ".####..", "..##..."],
          walkerColumn,
          horizon + bob,
          palette.skin,
        );
      },
      loopSeconds,
    };
  },
  name: "Night street",
};
