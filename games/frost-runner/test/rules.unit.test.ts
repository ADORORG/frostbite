import { describe, expect, it } from "vitest";

import { maxTicks } from "../src/rules/constants.ts";
import { runnerRules } from "../src/rules/index.ts";
import { advanceTo } from "../src/rules/tick.ts";
import type { RunnerState } from "../src/rules/types.ts";
import { startRunner } from "../src/rules/world.ts";

describe("a fresh run", () => {
  it("starts alive at the first tick with the world laid out ahead", () => {
    const run = startRunner(7);
    expect(run.alive).toBe(true);
    expect(run.tick).toBe(0);
    expect(run.obstacles.length).toBeGreaterThan(0);
    expect(run.obstacles[0]?.x).toBeGreaterThanOrEqual(120);
  });

  it("runs on its own until it hits something", () => {
    const run = advanceTo(startRunner(7), 2_000);
    expect(run.alive).toBe(false);
    expect(run.tick).toBeLessThan(400);
  });

  it("is the same world for the same seed, and another for another", () => {
    expect(startRunner(7)).toEqual(startRunner(7));
    expect(startRunner(7).obstacles).not.toEqual(startRunner(8).obstacles);
  });
});

describe("the rules as a verifier", () => {
  it("starts from a seed and no settings", () => {
    const started = runnerRules.init(5, {});
    expect(started.ok).toBe(true);
    expect(runnerRules.init(5, { mode: 1 })).toEqual({
      ok: false,
      reason: "no such setting: mode",
    });
  });
});

describe("the longest a run may be", () => {
  const clear = {
    ...startRunner(1),
    laidTo: 10 ** 9,
    obstacles: [],
    shards: [],
  };

  it("is where a run is stopped, however far it is asked to go", () => {
    const nearly = { ...clear, tick: maxTicks - 3 };
    expect(advanceTo(nearly, maxTicks + 500).tick).toBe(maxTicks);
  });

  it("refuses a tick beyond it, for a choice and for the end", () => {
    const beyond = { data: { tick: maxTicks + 1 }, type: "jump" };
    expect(runnerRules.step(clear, beyond)).toEqual({
      ok: false,
      reason: `tick must be from 0 to ${String(maxTicks)}`,
    });
    expect(runnerRules.step(clear, { ...beyond, type: "end" }).ok).toBe(false);
  });
});

describe("what the rules refuse", () => {
  const run = (): RunnerState => startRunner(7);
  const refusal = (input: { data?: unknown; type: string }, state = run()) => {
    const stepped = runnerRules.step(state, input as never);
    return stepped.ok ? "accepted" : stepped.reason;
  };

  it("an input that is not one of theirs, and one that carries the wrong data", () => {
    expect(refusal({ type: "fly" })).toBe("no such input: fly");
    expect(refusal({ type: "jump" })).toBe("the input takes an object");
    expect(refusal({ data: { tick: 1, extra: 2 }, type: "jump" })).toBe(
      "the input takes exactly: tick",
    );
    expect(refusal({ data: { tick: 1.5 }, type: "jump" })).toBe(
      "tick must be a whole number",
    );
    expect(refusal({ data: { tick: "1" }, type: "slide" })).toBe(
      "tick must be a whole number",
    );
    expect(refusal({ data: {}, type: "end" })).toBe(
      "the input takes exactly: tick",
    );
  });

  it("a choice for a tick that is already past", () => {
    const later = advanceTo(run(), 10);
    expect(refusal({ data: { tick: 4 }, type: "jump" }, later)).toBe(
      "tick 4 is already past",
    );
    expect(refusal({ data: { tick: 4 }, type: "end" }, later)).toBe(
      "tick 4 is already past",
    );
  });

  it("a second action while one is going on, naming which", () => {
    const jumping = runnerRules.step(run(), {
      data: { tick: 0 },
      type: "jump",
    });
    if (!jumping.ok) throw new Error("jump");
    expect(refusal({ data: { tick: 3 }, type: "slide" }, jumping.state)).toBe(
      "already jumping",
    );
    const sliding = runnerRules.step(run(), {
      data: { tick: 0 },
      type: "slide",
    });
    if (!sliding.ok) throw new Error("slide");
    expect(refusal({ data: { tick: 3 }, type: "jump" }, sliding.state)).toBe(
      "already sliding",
    );
  });

  it("a choice after the runner was stopped, and anything after the end", () => {
    expect(refusal({ data: { tick: 1_000 }, type: "jump" })).toMatch(
      /^the runner was stopped on tick \d+$/u,
    );
    const ended = runnerRules.step(run(), { data: { tick: 5 }, type: "end" });
    if (!ended.ok) throw new Error("end");
    expect(ended.state.ended).toBe(true);
    expect(refusal({ data: { tick: 6 }, type: "jump" }, ended.state)).toBe(
      "the run has ended",
    );
  });

  it("a choice at the very end of a run that has gone as long as it may", () => {
    const clear = {
      ...startRunner(1),
      laidTo: 10 ** 9,
      obstacles: [],
      shards: [],
      tick: maxTicks,
    };
    expect(refusal({ data: { tick: maxTicks }, type: "jump" }, clear)).toBe(
      "accepted",
    );
    const last = { ...clear, tick: maxTicks - 1 };
    const moved = runnerRules.step(last, {
      data: { tick: maxTicks },
      type: "jump",
    });
    expect(moved.ok).toBe(true);
  });
});
