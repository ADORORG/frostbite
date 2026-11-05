import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import { matchRules } from "../src/rules/index.ts";
import { legalMoves } from "../src/rules/moves.ts";
import { sampleRun } from "../src/sample-run.ts";
import { createMatchSession } from "../src/session.ts";
import { greedyPlayer, play, randomPlayer } from "./support/bots.ts";

describe("a session", () => {
  it("records the swaps the rules accept, and refuses one that makes no line without recording it", () => {
    const session = createMatchSession({ seed: 7 });
    const [cell, to] = legalMoves(session.state().board)[0] ?? [0, 1];
    const refused = session.swap(0, 0);
    expect(refused).toEqual({
      ok: false,
      reason: "that swap goes off the board",
    });
    expect(session.swap(cell, to)).toEqual({ ok: true });
    const record = session.record();
    expect(record.inputs).toEqual([
      { data: { cell, to }, type: "swap" },
      { type: "end" },
    ]);
    expect(session.swap(cell, to)).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    expect(session.state().ended).toBe(true);
  });

  it("makes a record the platform's replay accepts, and tells the page each milestone once", () => {
    const onEarned = vi.fn();
    const session = createMatchSession({ onEarned, seed: 5 });
    for (const { cell, to } of play(5, greedyPlayer, 40).swaps)
      session.swap(cell, to);
    const record = session.record();
    expect(replayRecord(matchRules, record)).toEqual({
      earned: record.claims,
      ok: true,
    });
    const ids = onEarned.mock.calls.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...session.earned()].sort());
    expect(ids).toContain("first-swap");
  });

  // Plays a whole run to its end: about 2 s alone, and many times that on a busy CI machine, so it has the time the other long tests have.
  it("does not close a run twice, nor one that ended itself", () => {
    const session = createMatchSession({ seed: 2 });
    const first = session.record();
    expect(session.record().inputs).toEqual(first.inputs);
    expect(first.inputs).toEqual([{ type: "end" }]);
    const over = createMatchSession({ seed: 3 });
    for (const { cell, to } of play(3, randomPlayer).swaps) over.swap(cell, to);
    expect(over.state().cause).toBe("out");
    expect(over.record().inputs.at(-1)).not.toEqual({ type: "end" });
  }, 60_000);
});

describe("the sample run", () => {
  it("is accepted by the rules and earns the milestones it claims", () => {
    const record = sampleRun();
    expect(replayRecord(matchRules, record)).toEqual({
      earned: record.claims,
      ok: true,
    });
    expect(record.claims.length).toBeGreaterThan(20);
  });
});
