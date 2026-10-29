import {
  ease,
  loopTime,
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  seededRandom,
  sprite,
  stars,
  type Scene,
} from "../engine/index.ts";

// Space shooter: a ship slides under the invaders and picks them off one at a time. Each invader is hit once a loop, bursts, and warps
// back in a few seconds later, so the formation is never empty and the end of the loop is the start of the next.
const aliens = [
  ["..####..", ".######.", "##.##.##", "########", ".#.##.#.", "#......#"],
  ["#..##..#", ".######.", "#.####.#", "########", "..#..#..", ".#....#."],
  ["..#..#..", ".######.", "##.##.##", ".######.", ".#.##.#.", "#.#..#.#"],
] as const;
const ship = [
  "...##...",
  "..####..",
  ".######.",
  "########",
  "##.##.##",
] as const;
const tints = [palette.green, palette.cyan, palette.pink] as const;

const columns = 6;
const lines = 3;
const count = columns * lines;
const shotSeconds = 0.8;
const loopSeconds = count * shotSeconds;
const aimSeconds = 0.25;
const flightSeconds = 0.45;
const burstSeconds = 0.3;
const goneSeconds = 3.1;
const warpSeconds = 0.5;
const flickerRate = 12;
const shipRow = 78;
const spacing = 18;
const lineSpacing = 11;
const alienWidth = 8;
const swayAmount = 12;
const swayCycles = 2;

export const shooter: Scene = {
  id: "shooter",
  make: () => {
    // Which invader is hit in which shot: shuffled once, the same every time.
    const random = seededRandom(11);
    const order = Array.from({ length: count }, (_, at) => at);
    for (let at = count - 1; at > 0; at -= 1) {
      const swap = Math.floor(random() * (at + 1));
      const kept = order[at] ?? 0;
      order[at] = order[swap] ?? 0;
      order[swap] = kept;
    }
    const sway = (t: number) =>
      22 + Math.sin((t / loopSeconds) * Math.PI * 2 * swayCycles) * swayAmount;
    const place = (index: number, t: number) => ({
      x: sway(t) + (index % columns) * spacing,
      y: 8 + Math.floor(index / columns) * lineSpacing,
    });
    // The moment each invader is hit.
    const hitAt = (index: number) =>
      order.indexOf(index) * shotSeconds + aimSeconds + flightSeconds;
    const aimX = (shot: number) => {
      const index = order[((shot % count) + count) % count] ?? 0;
      return (
        place(index, shot * shotSeconds + aimSeconds + flightSeconds).x +
        alienWidth / 2
      );
    };
    return {
      draw: (surface, t) => {
        rect(surface, 0, 0, sceneWidth, sceneHeight, palette.background);
        stars(surface, 2, 50, 85);
        for (let index = 0; index < count; index += 1) {
          const since = loopTime(t - hitAt(index), loopSeconds);
          const { x, y } = place(index, t);
          if (since < burstSeconds) {
            const spread = since / burstSeconds;
            for (let spark = 0; spark < 6; spark += 1)
              rect(
                surface,
                x + 4 + Math.cos(spark * 1.05) * spread * 8,
                y + 3 + Math.sin(spark * 1.05) * spread * 8,
                2,
                2,
                spark % 2 === 0 ? palette.yellow : palette.red,
              );
          } else if (since >= burstSeconds + goneSeconds) {
            // An invader flickers as it warps in, counted from its own arrival so the flicker is the same wherever the loop is cut.
            const arrived = since - burstSeconds - goneSeconds;
            if (
              arrived >= warpSeconds ||
              Math.floor(arrived * flickerRate) % 2 === 0
            )
              sprite(
                surface,
                aliens[index % aliens.length] ?? aliens[0],
                x,
                y,
                tints[index % tints.length] ?? palette.green,
              );
          }
        }
        // The ship slides to where the next invader will be, then fires.
        const shot = Math.floor(t / shotSeconds);
        const since = t - shot * shotSeconds;
        const from = aimX(shot - 1);
        const to = aimX(shot);
        const shipX = from + (to - from) * ease(since / aimSeconds);
        sprite(surface, ship, shipX - 4, shipRow, palette.cyan);
        const flying = (since - aimSeconds) / flightSeconds;
        if (flying > 0 && flying < 1) {
          const target =
            place(
              order[shot] ?? 0,
              shot * shotSeconds + aimSeconds + flightSeconds,
            ).y + 6;
          rect(
            surface,
            to,
            shipRow - 2 - flying * (shipRow - 2 - target),
            1,
            4,
            palette.yellow,
          );
        }
        rect(surface, 0, sceneHeight - 4, sceneWidth, 4, palette.deeper);
      },
      loopSeconds,
    };
  },
  name: "Space shooter",
};
