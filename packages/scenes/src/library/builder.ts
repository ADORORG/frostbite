import {
  ease,
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  seededRandom,
  stars,
  type Scene,
  type Surface,
} from "../engine/index.ts";

// Block builder: a tower that never ends. A block drops onto the top, the whole tower settles one block down, and the next one is
// already on its way, so the picture at any moment depends only on how far through a block's turn it is. The colours and offsets repeat
// every few blocks, so the loop closes.
const pattern = 8;
const blockWidth = 22;
const blockHeight = 6;
const turnSeconds = 1.25;
const loopSeconds = pattern * turnSeconds;
const topY = 28;
const settleShare = 0.3;
const dropFrom = 0.35;
const swayCycles = 2;
const leanPerBlock = 0.18;
// Block numbers are kept positive so a block's place in the pattern is its number modulo the pattern.
const origin = pattern * 10;
const tints = [
  palette.cyan,
  palette.pink,
  palette.yellow,
  palette.green,
  palette.purple,
] as const;

function brick(surface: Surface, x: number, y: number, colour: string) {
  rect(surface, x, y, blockWidth, blockHeight, colour);
  rect(surface, x, y, blockWidth, 1, palette.shine);
  rect(surface, x, y + blockHeight - 1, blockWidth, 1, palette.shade);
}

export const builder: Scene = {
  id: "builder",
  make: () => {
    const random = seededRandom(3);
    const offsets = Array.from(
      { length: pattern },
      () => (random() - 0.5) * 12,
    );
    const place = (block: number) => ({
      colour: tints[(block % pattern) % tints.length] ?? palette.cyan,
      x: (sceneWidth - blockWidth) / 2 + (offsets[block % pattern] ?? 0),
    });
    return {
      draw: (surface, t) => {
        rect(surface, 0, 0, sceneWidth, sceneHeight, palette.background);
        stars(surface, 9, 36, 40);
        const turn = Math.floor(t / turnSeconds);
        const share = t / turnSeconds - turn;
        // After a block lands, everything settles one block down.
        const settle = ease(share / settleShare) * blockHeight;
        const sway = Math.sin((t / loopSeconds) * Math.PI * 2 * swayCycles);
        for (let age = 0; topY + age * blockHeight < sceneHeight; age += 1) {
          const { colour, x } = place(turn - age + origin);
          const lean = sway * age * leanPerBlock;
          brick(surface, x + lean, topY + age * blockHeight + settle, colour);
        }
        // The next block falls from the top and lands where the tower's top will be.
        const next = place(turn + 1 + origin);
        const fall = Math.max(0, (share - dropFrom) / (1 - dropFrom));
        const y = -blockHeight + (topY + blockHeight) * fall * fall;
        brick(surface, next.x, y, next.colour);
      },
      loopSeconds,
    };
  },
  name: "Block builder",
};
