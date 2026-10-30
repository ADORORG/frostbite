import { describe, expect, it } from "vitest";

import {
  firstObstacleAt,
  horizon,
  lastLevel,
  levelLength,
  sizes,
} from "../src/rules/constants.ts";
import { levelAt, speedAt } from "../src/rules/course.ts";
import { patterns } from "../src/rules/patterns.ts";
import { layAhead } from "../src/rules/spawn.ts";
import { startRun } from "../src/rules/state.ts";
import type { RunState } from "../src/rules/types.ts";

const course = (seed: number, distance: number): RunState =>
  layAhead(startRun(seed), distance);
const longestPattern = 6_000;
const seeds = Array.from({ length: 60 }, (_, index) => index * 7 + 1);

describe("the course", () => {
  it("is laid from the seed alone: the same seed lays the same slope, and another seed another", () => {
    expect(startRun(9).ahead).toEqual(startRun(9).ahead);
    expect(startRun(9).ahead).not.toEqual(startRun(10).ahead);
    expect(startRun(9).shards).not.toEqual(startRun(10).shards);
  });

  it("is the same whenever it is laid: laying further on keeps what was laid before", () => {
    const near = startRun(5);
    const far = course(5, 400_000);
    expect(far.ahead.slice(0, near.ahead.length)).toEqual(near.ahead);
    expect(far.shards.slice(0, near.shards.length)).toEqual(near.shards);
    expect(far.generator).not.toBe(near.generator);
  });

  it("starts with a clear stretch and reaches `horizon` ahead of the snowball", () => {
    const state = startRun(3);
    expect(state.ahead[0]?.x ?? 0).toBeGreaterThanOrEqual(firstObstacleAt);
    expect(state.nextAt).toBeGreaterThanOrEqual(horizon);
    const later = course(3, 50_000);
    expect(later.nextAt).toBeGreaterThanOrEqual(50_000 + horizon);
  });

  it("lays nothing more when it has already laid far enough, and hands back the same state", () => {
    const state = startRun(4);
    expect(layAhead(state, 0)).toBe(state);
  });

  it("is in order, with no obstacle on another and room to land between any two", () => {
    for (const seed of seeds) {
      const { ahead } = course(seed, 600_000);
      for (let at = 1; at < ahead.length; at += 1) {
        const before = ahead[at - 1];
        const next = ahead[at];
        if (before === undefined || next === undefined) throw new Error("hole");
        // The closest parts of any pattern are seven ticks of rolling apart, at the speed where the pattern began: no further back than the
        // longest pattern is long.
        const speed = speedAt(
          Math.min(lastLevel, levelAt(Math.max(0, before.x - longestPattern))),
        );
        expect(
          next.x - (before.x + before.w),
          `seed ${String(seed)}`,
        ).toBeGreaterThanOrEqual(7 * speed);
      }
    }
  });

  it("makes each obstacle as big as its kind says, and every crevasse at least as wide as a hop's start needs", () => {
    for (const seed of seeds.slice(0, 20))
      for (const obstacle of course(seed, 600_000).ahead) {
        if (obstacle.kind === "pit") {
          expect(obstacle.h).toBe(0);
          const speed = speedAt(Math.min(lastLevel, levelAt(obstacle.x)));
          expect(obstacle.w).toBeGreaterThanOrEqual(18 * speed);
        } else {
          expect(obstacle.h).toBe(sizes[obstacle.kind].h);
          expect(obstacle.w).toBe(sizes[obstacle.kind].w);
        }
      }
  });

  it("puts every shard where a hop can reach it", () => {
    for (const seed of seeds.slice(0, 20))
      for (const shard of course(seed, 600_000).shards) {
        expect(shard.y).toBeGreaterThanOrEqual(40);
        expect(shard.y).toBeLessThanOrEqual(260);
      }
  });

  it("brings in harder patterns as the slope goes on, each one only from its level", () => {
    const seen = new Map<number, Set<string>>();
    for (const seed of seeds) {
      const { ahead } = course(seed, 3_500_000);
      for (const obstacle of ahead) {
        const level = Math.min(lastLevel, levelAt(obstacle.x));
        const kinds = seen.get(level) ?? new Set<string>();
        kinds.add(obstacle.kind);
        seen.set(level, kinds);
      }
    }
    expect([...(seen.get(0) ?? [])]).toEqual(["rock"]);
    expect(seen.get(1)?.has("boulder")).toBe(true);
    expect(seen.get(1)?.has("pit")).toBe(false);
    expect(seen.get(2)?.has("pit")).toBe(true);
    expect(seen.get(3)?.has("spikes")).toBe(false);
    expect(seen.get(4)?.has("spikes")).toBe(true);
  });

  it("has a table of patterns that is in order of level, each with its own name and some chance", () => {
    const ids = patterns.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(patterns[0]?.from).toBe(0);
    for (let at = 1; at < patterns.length; at += 1)
      expect(patterns[at]?.from).toBeGreaterThanOrEqual(
        patterns[at - 1]?.from ?? 0,
      );
    for (const pattern of patterns) expect(pattern.weight).toBeGreaterThan(0);
  });

  it("uses every pattern in the table somewhere on a long slope", () => {
    const lengths = new Set<string>();
    for (const seed of seeds) {
      const { ahead } = course(seed, 4_000_000);
      for (let at = 0; at < ahead.length; at += 1) {
        const shape = ahead
          .slice(at, at + 3)
          .map(({ kind }) => kind)
          .join(">");
        lengths.add(shape);
      }
    }
    for (const shape of [
      "rock>rock>rock",
      "pit>pit",
      "spikes>boulder",
      "rock>pit>boulder",
      "boulder>rock",
    ])
      expect([...lengths].some((found) => found.startsWith(shape))).toBe(true);
  });

  it("is longer at the first levels than a level is long, so the first patterns are not all at once", () => {
    expect(startRun(2).ahead.length).toBeLessThan(levelLength);
  });
});
