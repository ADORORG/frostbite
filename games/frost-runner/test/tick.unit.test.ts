import { describe, expect, it } from "vitest";

import { baseSpeed, jumpTicks } from "../src/rules/constants.ts";
import { advanceTo, tickOnce } from "../src/rules/tick.ts";
import { empty, icicle, shard, spike, withWorld } from "./support/states.ts";

describe("one tick", () => {
  it("scrolls the world by the speed, and adds that distance", () => {
    const next = tickOnce(withWorld([spike(100)], [shard(50)]));
    expect(next.tick).toBe(1);
    expect(next.distance).toBe(baseSpeed);
    expect(next.obstacles[0]?.x).toBe(100 - baseSpeed);
    expect(next.shards[0]?.x).toBe(50 - baseSpeed);
    expect(next.laidTo).toBe(empty().laidTo - baseSpeed);
  });

  it("changes nothing for a run that has ended or whose runner is stopped", () => {
    const stopped = { ...empty(), alive: false };
    expect(tickOnce(stopped)).toBe(stopped);
    const ended = { ...empty(), ended: true };
    expect(tickOnce(ended)).toBe(ended);
  });

  it("ends the run when the runner meets a spike on the ground, and counts nothing that tick", () => {
    const next = tickOnce(withWorld([spike(10)]));
    expect(next.alive).toBe(false);
    expect(next.cleared).toBe(0);
  });

  it("ends the run when the runner stands under an icicle", () => {
    expect(tickOnce(withWorld([icicle(10)])).alive).toBe(false);
  });

  it("lets a sliding runner pass under an icicle, and a jumping one over a spike", () => {
    const sliding = withWorld([icicle(10)], [], {
      action: { kind: "slide", tick: 2 },
    });
    expect(tickOnce(sliding).alive).toBe(true);
    const jumping = withWorld([spike(10)], [], {
      action: { kind: "jump", tick: jumpTicks / 2 - 1 },
    });
    expect(tickOnce(jumping).alive).toBe(true);
  });
});

describe("getting past obstacles", () => {
  it("counts an obstacle once it has gone by, and takes it out of the world", () => {
    const next = tickOnce(
      withWorld([icicle(-14 + baseSpeed - 1)], [], {
        action: { kind: "slide", tick: 2 },
      }),
    );
    expect(next.alive).toBe(true);
    expect(next.cleared).toBe(1);
    expect(next.obstacles).toEqual([]);
  });

  it("counts a close call for a spike cleared with almost no room, and not for one cleared with plenty", () => {
    const close = withWorld(
      [{ ...spike(-12 + baseSpeed - 1), lowestClearance: 2 }],
      [],
      { action: { kind: "jump", tick: 12 } },
    );
    expect(tickOnce(close).closeCalls).toBe(1);
    const roomy = withWorld(
      [{ ...spike(-12 + baseSpeed - 1), lowestClearance: 9 }],
      [],
      { action: { kind: "jump", tick: 12 } },
    );
    expect(tickOnce(roomy).closeCalls).toBe(0);
    const never = withWorld(
      [{ ...icicle(-14 + baseSpeed - 1), lowestClearance: null }],
      [],
      { action: { kind: "slide", tick: 2 } },
    );
    expect(tickOnce(never).closeCalls).toBe(0);
  });

  it("counts a close call at the clearance limit and not past it", () => {
    const at = (clearance: number) =>
      withWorld(
        [{ ...spike(-12 + baseSpeed - 1), lowestClearance: clearance }],
        [],
        { action: { kind: "jump", tick: 12 } },
      );
    expect(tickOnce(at(3)).closeCalls).toBe(1);
    expect(tickOnce(at(4)).closeCalls).toBe(0);
    expect(tickOnce(at(0)).closeCalls).toBe(1);
  });

  it("does not count an obstacle as cleared on the tick the runner is stopped", () => {
    const next = tickOnce(withWorld([spike(-12 + baseSpeed - 1), icicle(5)]));
    expect(next.alive).toBe(false);
    expect(next.cleared).toBe(0);
    expect(next.closeCalls).toBe(0);
  });

  it("notes how low the runner's feet were over a spike while it passed", () => {
    let run = withWorld([spike(48)], [], { action: { kind: "jump", tick: 0 } });
    for (let at = 0; at < 14; at += 1) run = tickOnce(run);
    expect(run.obstacles[0]?.lowestClearance).not.toBeNull();
    expect(run.alive).toBe(true);
    expect(run.obstacles[0]?.lowestClearance ?? 99).toBeLessThanOrEqual(
      26 - 10,
    );
  });
});

describe("taking shards", () => {
  it("picks up a low shard from the ground and counts it, and a high one only from the air", () => {
    const low = tickOnce(withWorld([], [shard(5)]));
    expect(low.shardsTaken).toBe(1);
    expect(low.shards).toEqual([]);
    expect(low.highShards).toBe(0);
    const missed = tickOnce(withWorld([], [shard(5, true)]));
    expect(missed.shardsTaken).toBe(0);
    const high = tickOnce(
      withWorld([], [shard(5, true)], {
        action: { kind: "jump", tick: jumpTicks / 2 - 1 },
      }),
    );
    expect(high.shardsTaken).toBe(1);
    expect(high.highShards).toBe(1);
  });

  it("lets a shard that was not taken go by and drops it", () => {
    const next = tickOnce(withWorld([], [shard(-10)]));
    expect(next.shards).toEqual([]);
    expect(next.shardsTaken).toBe(0);
  });
});

describe("going on to a tick", () => {
  it("stops where the runner is stopped", () => {
    const run = advanceTo(withWorld([spike(60)]), 500);
    expect(run.alive).toBe(false);
    expect(run.tick).toBeLessThan(60);
  });

  it("lays out more world as it scrolls, so a long run never runs out", () => {
    const run = advanceTo(empty(), 5);
    expect(run.tick).toBe(5);
    expect(run.alive).toBe(true);
  });
});
