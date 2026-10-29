import { describe, expect, it } from "vitest";

import {
  baseSpeed,
  gapBase,
  gapPerSpeed,
  icicleWidth,
  speedStepUnits,
  spikeWidth,
  spawnHorizon,
  topSpeedBonus,
} from "../src/rules/constants.ts";
import {
  spawnAhead,
  speedAt,
  startRunner,
  widthOf,
} from "../src/rules/world.ts";
import { empty, icicle, spike } from "./support/states.ts";

describe("how fast the world goes", () => {
  it("starts at the base speed, goes up one every step of distance, and stops at the top speed", () => {
    expect(speedAt(0)).toBe(baseSpeed);
    expect(speedAt(speedStepUnits - 1)).toBe(baseSpeed);
    expect(speedAt(speedStepUnits)).toBe(baseSpeed + 1);
    expect(speedAt(speedStepUnits * 3)).toBe(baseSpeed + 3);
    expect(speedAt(speedStepUnits * 50)).toBe(baseSpeed + topSpeedBonus);
  });
});

describe("laying out the world", () => {
  it("lays out as far ahead as the runner can see, and no obstacle starts before the first is due", () => {
    const run = startRunner(3);
    expect(run.laidTo).toBeGreaterThanOrEqual(spawnHorizon);
    expect(run.obstacles[0]?.x).toBeGreaterThanOrEqual(120);
  });

  it("leaves room to react: each obstacle starts at least a gap after the last one ends, and the gap grows with speed", () => {
    for (const distance of [0, speedStepUnits * 2, speedStepUnits * 5]) {
      const laid = spawnAhead({
        ...empty(),
        distance,
        laidTo: 0,
        obstacles: [],
        shards: [],
      });
      const [first, ...rest] = laid.obstacles;
      let end = (first?.x ?? 0) + widthOf(first ?? spike(0));
      for (const next of rest) {
        expect(next.x - end).toBeGreaterThanOrEqual(
          gapBase + speedAt(distance) * gapPerSpeed,
        );
        end = next.x + widthOf(next);
      }
    }
  });

  it("makes spikes and icicles, and measures each", () => {
    const kinds = new Set<string>();
    let run = spawnAhead({ ...empty(), laidTo: 0 });
    for (let at = 0; at < 40; at += 1) {
      run = spawnAhead({ ...run, laidTo: run.laidTo - 200 });
    }
    for (const obstacle of run.obstacles) kinds.add(obstacle.kind);
    expect([...kinds].sort()).toEqual(["icicle", "spike"]);
    expect(widthOf(spike(0))).toBe(spikeWidth);
    expect(widthOf(icicle(0))).toBe(icicleWidth);
  });

  it("puts shards in runs of three before some obstacles: high ones over a spike, low ones before an icicle", () => {
    let run = spawnAhead({ ...empty(), laidTo: 0 });
    for (let at = 0; at < 60; at += 1)
      run = spawnAhead({ ...run, laidTo: run.laidTo - 200 });
    expect(run.shards.length).toBeGreaterThan(0);
    expect(run.shards.length % 3).toBe(0);
    expect(run.shards.some((shard) => shard.high)).toBe(true);
    expect(run.shards.some((shard) => !shard.high)).toBe(true);
  });

  it("lays out the same world for the same seed, and another for another", () => {
    expect(startRunner(9)).toEqual(startRunner(9));
    expect(startRunner(9).obstacles).not.toEqual(startRunner(10).obstacles);
  });
});
