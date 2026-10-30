import { describe, expect, it } from "vitest";

import { snowballRules } from "../src/rules/index.ts";
import { createRunSession } from "../src/session.ts";
import { playWithLead } from "./support/bot.ts";

describe("a run as the player plays it", () => {
  it("records a hop with the tick it was made on, and ends the run when a rock is hit", () => {
    const session = createRunSession({ seed: 1 });
    for (let at = 0; at < 5; at += 1) session.tick();
    expect(session.hop().ok).toBe(true);
    expect(session.hop()).toEqual({ ok: false, reason: "already in the air" });
    while (!session.state().ended) session.tick();
    const record = session.record();
    expect(record.inputs[0]).toEqual({ data: { tick: 5 }, type: "hop" });
    expect(record.inputs.at(-1)?.type).toBe("end");
    expect(session.state().alive).toBe(false);
  });

  it("refuses a hop once the run is over, and keeps ticking harmlessly", () => {
    const session = createRunSession({ seed: 1 });
    while (!session.state().ended) session.tick();
    const tick = session.state().tick;
    expect(session.hop()).toEqual({ ok: false, reason: "the run has ended" });
    session.tick();
    expect(session.state().tick).toBe(tick);
  });

  it("announces each milestone once, as it is earned", () => {
    const heard: string[] = [];
    const session = playWithLead(20_261_030, 14, (id) => heard.push(id));
    expect(heard).toEqual([...new Set(heard)]);
    expect([...heard].sort()).toEqual([...session.earned()].sort());
    expect(heard).toHaveLength(10);
  });

  it("closes a run that is still going when its record is asked for, once", () => {
    const session = createRunSession({ seed: 2 });
    session.tick();
    const first = session.record();
    expect(first.inputs.filter(({ type }) => type === "end")).toHaveLength(1);
    expect(session.record().inputs).toEqual(first.inputs);
  });

  it("makes a record the rules replay to the same milestones", () => {
    const session = playWithLead(20_261_030, 14);
    const record = session.record();
    let state = snowballRules.init(record.seed, record.config);
    if (!state.ok) throw new Error(state.reason);
    for (const input of record.inputs) {
      const stepped = snowballRules.step(state.state, input);
      if (!stepped.ok) throw new Error(stepped.reason);
      state = stepped;
    }
    expect(snowballRules.earned(state.state)).toEqual(record.claims);
    expect(state.state).toEqual(session.state());
  });
});
