import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import { dropRules } from "../src/rules/index.ts";
import { sampleRun } from "../src/sample-run.ts";
import { createDropSession } from "../src/session.ts";
import { play } from "./support/bot.ts";

describe("a session", () => {
  it("records the moves the rules accept, and refuses one that changes nothing without recording it", () => {
    const session = createDropSession({ seed: 7 });
    const refused = (["left", "right", "up", "down"] as const).find(
      (direction) => !session.move(direction).ok,
    );
    const record = session.record();
    const moves = record.inputs.filter(({ type }) => type !== "end");
    expect(moves).toHaveLength(session.state().moves);
    expect(record.inputs.at(-1)).toEqual({ type: "end" });
    if (refused !== undefined)
      expect(session.move(refused)).toEqual({
        ok: false,
        reason: "the run has ended",
      });
  });

  it("makes a record the platform's replay accepts, with the milestones the player saw", () => {
    const onEarned = vi.fn();
    const session = createDropSession({ onEarned, seed: 5 });
    const { inputs } = play(5, 300);
    for (const input of inputs.slice(0, -1))
      expect(
        session.move(input.type as "down" | "left" | "right" | "up"),
      ).toEqual({ ok: true });
    const record = session.record();
    expect(record.inputs).toEqual(inputs);
    expect(replayRecord(dropRules, record)).toMatchObject({
      earned: record.claims,
      ok: true,
    });
    const ids = onEarned.mock.calls.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...record.claims].sort());
  });

  it("closes a run once, and keeps the same record however often it is asked for", () => {
    const session = createDropSession({ seed: 9 });
    session.move("down");
    const first = session.record();
    expect(session.record()).toEqual(first);
    expect(first.inputs.filter(({ type }) => type === "end")).toHaveLength(1);
  });
});

describe("the sample run the verifier is registered with", () => {
  const run = sampleRun();

  it("names this game's verifier and is the same run every time", () => {
    expect(run).toMatchObject({
      gameId: "icicle-drop",
      verifier: "icicle-drop",
      verifierVersion: 1,
    });
    expect(sampleRun()).toEqual(run);
  });

  it("is a legal run that earns exactly the milestones it claims", () => {
    expect(replayRecord(dropRules, run)).toMatchObject({
      earned: run.claims,
      ok: true,
    });
  });
});
