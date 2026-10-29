import {
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  sprite,
  type Scene,
} from "../engine/index.ts";

// Side runner: a hero hops obstacles and gathers coins while mountains and clouds drift by. The loop is 20 seconds and every scroll
// speed divides it into a whole number of its own repeat lengths, so the picture closes without a jump.
const hero = [
  "..###..",
  ".#####.",
  "..###..",
  ".#####.",
  "#.###.#",
  "..###..",
  ".#...#.",
  ".#...#.",
] as const;
const loopSeconds = 20;
const ground = 72;
const scrollSpeed = 55;
const mountainSpeed = 8;
const mountainRepeat = 160;
const cloudSpeed = 4;
const cloudRepeat = 80;
const stripeRepeat = 20;
const heroColumn = 30;
const obstacleHitColumn = 42;
const jumpSeconds = 0.8;
const jumpHeight = 20;
// When each obstacle reaches the hero, spaced so the whole run fits the loop.
const reaches = Array.from({ length: 8 }, (_, at) => 2.5 + at * 2.2);

export const runner: Scene = {
  id: "runner",
  make: () => ({
    draw: (surface, t) => {
      rect(surface, 0, 0, sceneWidth, ground, palette.deep);
      rect(surface, 0, 40, sceneWidth, 32, palette.deeper);
      rect(surface, 116, 12, 14, 14, palette.pink);
      const mountainShift = (t * mountainSpeed) % mountainRepeat;
      for (let repeat = -1; repeat <= 1; repeat += 1) {
        for (let peak = 0; peak < 4; peak += 1) {
          const left = repeat * mountainRepeat - mountainShift + peak * 44;
          for (let line = 0; line < 22; line += 1) {
            const across = left + line;
            const length = 44 - line * 2;
            rect(surface, across, ground - 22 + line, length, 1, palette.ridge);
          }
        }
      }
      const cloudShift = (t * cloudSpeed) % cloudRepeat;
      for (let repeat = -1; repeat <= 2; repeat += 1) {
        const left = repeat * cloudRepeat - cloudShift + 20;
        rect(surface, left, 18, 16, 3, palette.cloud);
        rect(surface, left + 4, 15, 8, 3, palette.cloud);
      }
      rect(
        surface,
        0,
        ground,
        sceneWidth,
        sceneHeight - ground,
        palette.ground,
      );
      rect(surface, 0, ground, sceneWidth, 2, palette.green);
      for (
        let x = -((t * scrollSpeed) % stripeRepeat);
        x < sceneWidth;
        x += stripeRepeat
      ) {
        rect(surface, x, 78, 8, 1, palette.deeper);
      }
      let lift = 0;
      for (const reach of reaches) {
        const x = obstacleHitColumn + (reach - t) * scrollSpeed;
        if (x > -8 && x < sceneWidth) {
          rect(surface, x, ground - 8, 8, 8, palette.red);
          rect(surface, x, ground - 8, 8, 1, palette.shine);
        }
        for (let coin = 0; coin < 3; coin += 1) {
          const coinX = x - 12 + coin * 12;
          if (coinX > -3 && coinX < sceneWidth) {
            rect(
              surface,
              coinX,
              ground - 26 + Math.abs(coin - 1) * 5,
              3,
              3,
              palette.yellow,
            );
          }
        }
        const since = t - (reach - jumpSeconds / 2);
        if (since > 0 && since < jumpSeconds) {
          lift = Math.max(
            lift,
            Math.sin((since / jumpSeconds) * Math.PI) * jumpHeight,
          );
        }
      }
      sprite(
        surface,
        hero,
        heroColumn,
        ground - hero.length - lift,
        palette.cyan,
      );
    },
    loopSeconds,
  }),
  name: "Side runner",
};
