import {
  canonicalJson,
  maxRunRecordBytes,
  runRecordSchema,
  type RunRecord,
} from "@frostbite/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import { button, maxTicks } from "../src/rules/constants.ts";
import { rules, type RunState } from "../src/rules/index.ts";
import { createRunSession } from "../src/session.ts";

const replay = (record: RunRecord): RunState => {
  const begun = rules.init(record.seed, record.config);
  if (!begun.ok) throw new Error(begun.reason);
  let state = begun.state;
  for (const input of record.inputs) {
    const next = rules.step(state, input);
    if (!next.ok) throw new Error(`${next.reason} (${JSON.stringify(input)})`);
    state = next.state;
  }
  return state;
};

describe("a run as it is played", () => {
  it("records only what the hands changed, and replays to the same end", () => {
    const earned: string[] = [];
    const session = createRunSession({
      onEarned: (id) => earned.push(id),
      seed: 4242,
    });
    expect(session.choose(4).ok).toBe(true);
    for (let tick = 0; tick < 2400; tick += 1) {
      session.hands(Math.floor(tick / 40) % 16, tick % 90 < 4 ? button.hop : 0);
      session.tick();
    }
    const record = session.record();
    expect(runRecordSchema.parse(record)).toEqual(record);
    const replayed = replay(record);
    const played = session.state();
    expect(replayed.tick).toBe(played.tick);
    expect(replayed.score).toBe(played.score);
    expect(JSON.stringify(replayed.tallies)).toBe(
      JSON.stringify(played.tallies),
    );
    expect(rules.earned(replayed)).toEqual(record.claims);
    expect([...earned].sort()).toEqual([...record.claims].sort());
  });

  it("keeps a press that is let go before the rules would take another change", () => {
    const session = createRunSession({ seed: 9 });
    session.choose(0);
    for (let tick = 0; tick < 6; tick += 1) session.tick();
    session.hands(-1, button.hop);
    session.hands(-1, 0);
    session.tick();
    const record = session.record();
    const pads = record.inputs
      .filter((input) => input.type === "p")
      .map((input) => input.data);
    expect(pads[0]).toEqual([6, -1, button.hop]);
  });

  it("keeps changes at least three ticks apart however fast the hands are", () => {
    const session = createRunSession({ seed: 5 });
    session.choose(1);
    for (let tick = 0; tick < 300; tick += 1) {
      session.hands(tick % 16, 0);
      session.tick();
    }
    const ticks = session
      .record()
      .inputs.filter((input) => input.type === "p")
      .map((input) => (Array.isArray(input.data) ? Number(input.data[0]) : -1));
    for (let at = 1; at < ticks.length; at += 1)
      expect((ticks[at] ?? 0) - (ticks[at - 1] ?? 0)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the busiest possible run inside the size a record may be", () => {
    const session = createRunSession({ seed: 77 });
    session.choose(2);
    for (
      let tick = 0;
      tick < maxTicks + 10 && !session.state().ended;
      tick += 1
    ) {
      session.hands(tick % 16, tick % 2 === 0 ? button.duck : 0);
      session.tick();
    }
    const record = session.record();
    expect(record.inputs.at(-1)?.type).toBe("end");
    expect(new TextEncoder().encode(canonicalJson(record)).length).toBeLessThan(
      maxRunRecordBytes,
    );
    expect(replay(record).ended).toBe(true);
  });
});
