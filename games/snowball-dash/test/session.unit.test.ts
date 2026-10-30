import { describe, expect, it } from "vitest";

import { snowballRules } from "../src/rules/index.ts";
import { createRunSession } from "../src/session.ts";
import { play } from "./support/planner.ts";

const ticks = (session: ReturnType<typeof createRunSession>, count: number) => {
  for (let at = 0; at < count; at += 1) session.tick();
};

describe("a run as the player plays it", () => {
  it("rolls on a tick at a time, and a button held down is a hop", () => {
    const session = createRunSession({ seed: 3 });
    ticks(session, 10);
    expect(session.state().tick).toBe(10);
    expect(session.hold(true)).toEqual({ ok: true });
    ticks(session, 2);
    expect(session.state().hops).toBe(1);
  });

  it("asks nothing of a button that is already in the state it is told, and records nothing for it", () => {
    const session = createRunSession({ seed: 3 });
    expect(session.hold(false)).toEqual({ ok: true });
    session.hold(true);
    expect(session.hold(true)).toEqual({ ok: true });
    const record = session.record();
    expect(record.inputs.filter(({ type }) => type === "hop")).toHaveLength(1);
  });

  it("announces each milestone once, as the tick that earns it, in the order earned", () => {
    const heard: string[] = [];
    const session = createRunSession({
      onEarned: (id) => heard.push(id),
      seed: 3,
    });
    session.hold(true);
    ticks(session, 5);
    ticks(session, 5);
    expect(heard).toEqual(["first-hop", "height-120"]);
    expect(session.earned()).toEqual(heard);
  });

  it("closes a run that has met a rock, once, and refuses any more choices", () => {
    const session = createRunSession({ seed: 3 });
    ticks(session, 400);
    expect(session.state().alive).toBe(false);
    expect(session.hold(true)).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    const first = session.record();
    expect(first.inputs.filter(({ type }) => type === "end")).toHaveLength(1);
    expect(session.record().inputs).toEqual(first.inputs);
    const tick = session.state().tick;
    session.tick();
    expect(session.state().tick).toBe(tick);
  });

  it("closes a run that has been asked for its record while it is still going", () => {
    const session = createRunSession({ seed: 3 });
    ticks(session, 5);
    expect(session.state().ended).toBe(false);
    const record = session.record();
    expect(record.inputs.at(-1)).toEqual({ data: { tick: 5 }, type: "end" });
    expect(session.state().ended).toBe(true);
  });

  it("makes a record the rules replay to the same milestones, and says what it claims", () => {
    const played = play(20_261_030, 1_500);
    const session = createRunSession({ seed: 20_261_030 });
    const choices = played.inputs.map((input) => ({
      on: (input.data as { on: number }).on === 1,
      tick: (input.data as { tick: number }).tick,
    }));
    let next = 0;
    while (!session.state().ended && session.state().tick < 1_500) {
      while (
        next < choices.length &&
        (choices[next]?.tick ?? 0) <= session.state().tick
      ) {
        session.hold(choices[next]?.on ?? false);
        next += 1;
      }
      session.tick();
    }
    const record = session.record();
    let state = snowballRules.init(record.seed, record.config);
    if (!state.ok) throw new Error(state.reason);
    for (const input of record.inputs) {
      const stepped = snowballRules.step(state.state, input);
      if (!stepped.ok) throw new Error(stepped.reason);
      state = stepped;
    }
    expect(snowballRules.earned(state.state)).toEqual(record.claims);
    expect(record.claims.length).toBeGreaterThan(5);
  });
});
