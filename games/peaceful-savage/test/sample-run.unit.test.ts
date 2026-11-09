import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { savageRules } from "../src/rules/index.ts";
import { familySpots } from "../src/rules/layout.ts";
import { milestoneIds } from "../src/rules/milestones.ts";
import { sampleRun } from "../src/sample-run.ts";
import { createRunSession } from "../src/session.ts";
import { played } from "./support/states.ts";

describe("the sample run the verifier is shown with", () => {
  it("replays, and earns exactly the milestones it claims", () => {
    const sample = sampleRun();
    const outcome = replayRecord(savageRules, sample);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect([...outcome.earned].sort()).toEqual([...sample.claims].sort());
    expect(sample.claims.every((id) => milestoneIds.includes(id))).toBe(true);
    expect(sample.claims).toHaveLength(32);
  });

  it("plays out the same way every time", () => {
    const { inputs, seed } = sampleRun();
    const first = played(seed, inputs);
    expect(played(seed, inputs)).toEqual(first);
    expect(first.cause).toBe("lit");
    expect(first.lead).toBe("zora");
  });

  it("is refused if an input is changed to one the rules do not allow", () => {
    const sample = sampleRun();
    const broken = {
      ...sample,
      inputs: [
        ...sample.inputs.slice(0, 3),
        { data: { tick: 1 }, type: "act" },
      ],
    };
    const outcome = replayRecord(savageRules, broken);
    expect(outcome.ok).toBe(false);
  });
});

describe("a run as the page plays it", () => {
  it("records only the inputs the rules accept, each on its tick", () => {
    const earned: string[] = [];
    const session = createRunSession({
      onEarned: (id) => earned.push(id),
      seed: 4,
    });
    expect(session.input("act")).toEqual({
      ok: false,
      reason: "nobody leads yet",
    });
    for (let at = 0; at < 5; at += 1) session.tick();
    expect(session.input("lead", { hero: 0 })).toEqual({ ok: true });
    expect(session.clock()).toBe(5);
    expect(session.state().lead).toBe("kai");
    session.input("move", { way: 8 });
    for (let at = 0; at < 30; at += 1) session.tick();
    expect(session.state().z).toBeGreaterThan(familySpots.kai.z);
    const record = session.record();
    expect(record.inputs.map(({ type }) => type)).toEqual([
      "lead",
      "move",
      "end",
    ]);
    expect(record.inputs[0]?.data).toEqual({ hero: 0, tick: 5 });
    expect(session.input("act")).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    session.tick();
    expect(session.clock()).toBe(35);
    expect(session.earned()).toEqual([]);
    expect(earned).toEqual([]);
  });

  it("tells the page each milestone once, as it is earned", () => {
    const earned: string[] = [];
    const session = createRunSession({
      onEarned: (id) => earned.push(id),
      seed: 4,
    });
    // Mama begins at the tree, so her first touch is right there.
    session.input("lead", { hero: 2 });
    session.input("act");
    expect(earned).toEqual(["first-touch"]);
    expect(session.record().claims).toEqual(["first-touch"]);
  });
});
