import { describe, expect, it } from "vitest";

import { maxTicks } from "../src/rules/constants.ts";
import { snowballRules } from "../src/rules/index.ts";
import type { SnowballState } from "../src/rules/types.ts";

const start = (seed = 1): SnowballState => {
  const made = snowballRules.init(seed, {});
  if (!made.ok) throw new Error(made.reason);
  return made.state;
};
const hopAt = (state: SnowballState, tick: unknown) =>
  snowballRules.step(state, {
    data: typeof tick === "object" ? undefined : { tick: tick as number },
    type: "hop",
  });
const reason = (stepped: ReturnType<typeof hopAt>): string =>
  stepped.ok ? "" : stepped.reason;

describe("the rules as a verifier", () => {
  it("starts a run from a seed, and refuses a setting it does not have", () => {
    expect(start(3).rocks).toEqual(start(3).rocks);
    const refused = snowballRules.init(1, { speed: 9 });
    expect(refused.ok).toBe(false);
    expect(refused.ok ? "" : refused.reason).toContain("speed");
  });

  it("hops on the tick named, rolling on to it first", () => {
    const stepped = hopAt(start(), 50);
    expect(stepped.ok && stepped.state).toMatchObject({
      air: 1,
      hops: 1,
      tick: 50,
    });
  });

  it("refuses a second hop while one is going, and takes one after it lands", () => {
    const first = hopAt(start(), 10);
    if (!first.ok) throw new Error("expected a hop");
    expect(reason(hopAt(first.state, 12))).toBe("already in the air");
    expect(hopAt(first.state, 40).ok).toBe(true);
  });

  it("refuses a hop with a bad tick, a tick already past, extra fields or no object", () => {
    const at = start();
    expect(reason(hopAt(at, 1.5))).toContain("whole number");
    expect(reason(hopAt(at, "x"))).toContain("whole number");
    expect(reason(hopAt(at, -1))).toContain("from 0 to");
    expect(reason(hopAt(at, maxTicks + 1))).toContain("from 0 to");
    expect(reason(hopAt({ ...at, tick: 9 }, 3))).toContain("already past");
    expect(
      reason(snowballRules.step(at, { data: { tick: 1, x: 2 }, type: "hop" })),
    ).toContain("exactly");
    expect(reason(hopAt(at, {}))).toContain("object");
  });

  it("refuses a hop the snowball never gets to make: after a rock, or at the foot", () => {
    const rocky = { ...start(), rocks: [40] };
    expect(reason(hopAt(rocky, 200))).toContain("hit a rock");
    const clear = { ...start(), rocks: [] };
    expect(reason(hopAt(clear, 2_000))).toContain("foot");
  });

  it("closes a run with end, and refuses anything after it", () => {
    const ended = snowballRules.step(start(), {
      data: { tick: 5 },
      type: "end",
    });
    if (!ended.ok) throw new Error("expected end");
    expect(ended.state).toMatchObject({ ended: true, tick: 5 });
    expect(reason(hopAt(ended.state, 6))).toBe("the run has ended");
    expect(
      reason(snowballRules.step(start(), { data: { tick: -2 }, type: "end" })),
    ).toContain("from 0 to");
  });

  it("refuses an input it does not know", () => {
    expect(reason(snowballRules.step(start(), { type: "dive" }))).toBe(
      "no such input: dive",
    );
  });
});
