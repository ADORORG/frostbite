import { stepInt } from "@frostbite/game-sdk/seeded";

import { dart as dartSpec, snowball as ballSpec } from "./constants.ts";
import { happen, nextId, type Draft } from "./draft.ts";
import type { Level } from "./levels.ts";
import { div, rimAt, toward } from "./ways.ts";

// Where and when what is thrown at the hero comes from: snowballs from the round's rim, faster each wave of fifteen seconds (some aimed at
// the hero from the second wave, some big), and darts from further out, aimed near the hero and announced before they fly. Every draw comes
// from the run's hazard generator, so a run's hazards are the same every time it is replayed.
export const thirds = 3;
export const waveOf = (draft: Pick<Draft, "tick" | "phaseTick">): number =>
  Math.min(3, div(draft.tick - draft.phaseTick, 900));

const roll = (draft: Draft, below: number): number => {
  const step = stepInt(draft.hazardRng, below);
  draft.hazardRng = step.state;
  return step.value;
};

const blocked = (level: Level, x: number, y: number): boolean =>
  level.solids.some(
    ([sx, sy, sr]) =>
      (sx - x) * (sx - x) + (sy - y) * (sy - y) < (sr + 900) * (sr + 900),
  ) ||
  level.cages.some(
    ([cx, cy]) => (cx - x) * (cx - x) + (cy - y) * (cy - y) < 2600 * 2600,
  );

const spawnPoint = (
  draft: Draft,
  level: Level,
  radius: number,
): [number, number] => {
  const [cx, cy] = level.rollCentre;
  let point: [number, number] = [cx, cy - radius];
  for (let tries = 0; tries < 8; tries += 1) {
    const [rx, ry] = rimAt(roll(draft, 32));
    point = [cx + div(rx * radius, 1000), cy + div(ry * radius, 1000)];
    if (!blocked(level, point[0], point[1])) return point;
  }
  return point;
};

const aimPoint = (
  draft: Draft,
  level: Level,
  aimed: boolean,
): [number, number] => {
  const [cx, cy] = level.rollCentre;
  const p = draft.player;
  const main = level.land[0];
  const playerOnMain =
    main !== undefined &&
    (p.x - main[0]) ** 2 + (p.y - main[1]) ** 2 <= main[2] * main[2];
  if (aimed && playerOnMain) return [p.x, p.y];
  const a = level.aimRadius;
  return [cx + roll(draft, 2 * a + 1) - a, cy + roll(draft, 2 * a + 1) - a];
};

export const spawn = (draft: Draft, level: Level): void => {
  const wave = waveOf(draft);
  const waves = level.waves;
  if (draft.hazardClock >= draft.nextSnowballAt) {
    draft.spawned += 1;
    const aimed =
      waves.aimedEvery > 0 &&
      wave >= 1 &&
      draft.spawned % waves.aimedEvery === 0;
    const big =
      waves.bigEvery > 0 && wave >= 1 && draft.spawned % waves.bigEvery === 0;
    const [x, y] = spawnPoint(draft, level, level.spawnRadius);
    const [tx, ty] = aimPoint(draft, level, aimed);
    const speed = div((waves.speed[wave] ?? 50) * (big ? 85 : 100), 100);
    const [vx, vy] = toward(x, y, tx, ty, speed);
    const r = big
      ? ballSpec.bigFrom + roll(draft, ballSpec.bigTo - ballSpec.bigFrom + 1)
      : ballSpec.from + roll(draft, ballSpec.to - ballSpec.from + 1);
    draft.snowballs.push({
      big,
      hoppedOver: false,
      id: nextId(draft),
      nearest: 1_000_000,
      r,
      rollsAt: draft.hazardClock + ballSpec.incomingTicks * thirds,
      vx,
      vy,
      x,
      y,
    });
    draft.nextSnowballAt =
      draft.hazardClock + (waves.every[wave] ?? 100) * thirds;
  }
  const dartEvery = waves.dartEvery[wave] ?? 0;
  if (dartEvery > 0 && draft.hazardClock >= draft.nextDartAt) {
    const [x, y] = spawnPoint(draft, level, level.dartRadius);
    const jitter = 1500;
    const tx = draft.player.x + roll(draft, 2 * jitter + 1) - jitter;
    const ty = draft.player.y + roll(draft, 2 * jitter + 1) - jitter;
    const [vx, vy] = toward(x, y, tx, ty, dartSpec.speed);
    draft.darts.push({
      dodged: false,
      fliesAt: draft.hazardClock + dartSpec.telegraphTicks * thirds,
      id: nextId(draft),
      range: level.dartRadius * 2,
      travelled: 0,
      vx,
      vy,
      x,
      y,
    });
    happen(draft, "dart", x, y);
    draft.nextDartAt = draft.hazardClock + dartEvery * thirds;
  } else if (dartEvery === 0 && draft.nextDartAt < draft.hazardClock) {
    draft.nextDartAt = draft.hazardClock;
  }
};
