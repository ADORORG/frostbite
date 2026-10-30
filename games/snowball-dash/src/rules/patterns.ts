import { sizes } from "./constants.ts";
import type { Obstacle, Shard } from "./types.ts";

// The shapes an obstacle course is made of. Each is laid from where it starts, at the speed the snowball will have there, and may draw
// numbers from the generator for how wide and how far apart its parts are. A pattern is a puzzle with an answer: the gap between its parts
// leaves time to land and hop again, and `test/fairness.unit.test.ts` has a player that looks ahead survive every one on many slopes.
export interface Laid {
  // How far the pattern reaches from where it starts.
  readonly length: number;
  readonly obstacles: readonly Obstacle[];
  readonly shards: readonly Shard[];
}

export type Draw = (below: number) => number;

export interface Pattern {
  readonly from: number;
  readonly id: string;
  readonly lay: (x: number, speed: number, level: number, draw: Draw) => Laid;
  readonly weight: number;
}

const rock = (x: number): Obstacle => ({ kind: "rock", x, ...sizes.rock });
const boulder = (x: number): Obstacle => ({
  kind: "boulder",
  x,
  ...sizes.boulder,
});
const spikes = (x: number): Obstacle => ({
  kind: "spikes",
  x,
  ...sizes.spikes,
});
const pit = (x: number, w: number): Obstacle => ({ h: 0, kind: "pit", w, x });

// Shards along a hop over something: `count` of them from `from` to `to`, rising to `top` in the middle.
function arc(from: number, to: number, top: number, count: number): Shard[] {
  return Array.from({ length: count }, (_, index) => {
    const along = count === 1 ? 0.5 : index / (count - 1);
    return {
      x: Math.round(from + (to - from) * along),
      y: Math.round(40 + (top - 40) * 4 * along * (1 - along)),
    };
  });
}

// How wide a crevasse is, in ticks of rolling: wider as the level rises.
const pitTicks = (level: number, draw: Draw): number =>
  18 + Math.min(10, Math.floor(level / 3)) + draw(5);

const ticks = (speed: number, count: number): number => speed * count;

const single = (obstacle: Obstacle, top: number): Laid => ({
  length: obstacle.w,
  obstacles: [obstacle],
  shards: arc(obstacle.x - 80, obstacle.x + obstacle.w + 80, top, 3),
});

// Parts laid one after another; shards ride over the whole run.
function chain(x: number, parts: readonly Obstacle[], top: number): Laid {
  const last = parts.at(-1);
  const end = last === undefined ? x : last.x + last.w;
  return {
    length: end - x,
    obstacles: parts,
    shards: arc(x - 80, end + 80, top, Math.max(3, parts.length * 2)),
  };
}

export const patterns: readonly Pattern[] = [
  { from: 0, id: "rock", lay: (x) => single(rock(x), 130), weight: 6 },
  { from: 1, id: "boulder", lay: (x) => single(boulder(x), 220), weight: 4 },
  {
    from: 2,
    id: "pit",
    lay(x, speed, level, draw) {
      const w = ticks(speed, pitTicks(level, draw));
      return single(pit(x, w), 150);
    },
    weight: 4,
  },
  {
    from: 3,
    id: "twin-rock",
    lay: (x, speed, _level, draw) =>
      chain(
        x,
        [rock(x), rock(x + sizes.rock.w + ticks(speed, 8 + draw(4)))],
        150,
      ),
    weight: 4,
  },
  { from: 4, id: "spikes", lay: (x) => single(spikes(x), 120), weight: 4 },
  {
    from: 5,
    id: "rock-pit",
    lay(x, speed, level, draw) {
      const start = x + sizes.rock.w + ticks(speed, 17 + draw(5));
      return chain(
        x,
        [rock(x), pit(start, ticks(speed, pitTicks(level, draw)))],
        170,
      );
    },
    weight: 3,
  },
  {
    from: 6,
    id: "boulder-rock",
    lay: (x, speed, _level, draw) =>
      chain(
        x,
        [boulder(x), rock(x + sizes.boulder.w + ticks(speed, 27 + draw(5)))],
        220,
      ),
    weight: 3,
  },
  {
    from: 8,
    id: "triple-rock",
    lay(x, speed, _level, draw) {
      const step = sizes.rock.w + ticks(speed, 7 + draw(3));
      return chain(x, [rock(x), rock(x + step), rock(x + 2 * step)], 160);
    },
    weight: 3,
  },
  {
    from: 9,
    id: "twin-pit",
    lay(x, speed, level, draw) {
      const first = ticks(speed, pitTicks(level, draw));
      const island = x + first + ticks(speed, 16 + draw(4));
      return chain(
        x,
        [pit(x, first), pit(island, ticks(speed, pitTicks(level, draw)))],
        170,
      );
    },
    weight: 3,
  },
  {
    from: 10,
    id: "spikes-boulder",
    lay: (x, speed, _level, draw) =>
      chain(
        x,
        [spikes(x), boulder(x + sizes.spikes.w + ticks(speed, 27 + draw(5)))],
        220,
      ),
    weight: 3,
  },
  {
    from: 12,
    id: "gauntlet",
    lay(x, speed, level, draw) {
      const rockAt = x;
      const pitAt = rockAt + sizes.rock.w + ticks(speed, 22 + draw(4));
      const pitWidth = ticks(speed, pitTicks(level, draw));
      const boulderAt = pitAt + pitWidth + ticks(speed, 27 + draw(4));
      const spikesAt = boulderAt + sizes.boulder.w + ticks(speed, 31 + draw(4));
      return chain(
        x,
        [
          rock(rockAt),
          pit(pitAt, pitWidth),
          boulder(boulderAt),
          spikes(spikesAt),
        ],
        230,
      );
    },
    weight: 2,
  },
];
