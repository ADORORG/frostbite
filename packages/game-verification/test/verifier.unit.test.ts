import type { RunRecord } from "@ador/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import { defineVerifier } from "../src/verifier.ts";
import { counterRules, crashingRules } from "./counter-game.ts";

const record = (over: Partial<RunRecord> = {}): RunRecord => ({
  claims: [],
  config: { target: 5 },
  gameId: "counting",
  inputs: [],
  schemaVersion: 1,
  seed: 0,
  verifier: "counter",
  verifierVersion: 1,
  ...over,
});
const add = (n: number) => ({ data: n, type: "add" });
const verifier = defineVerifier(counterRules);

describe("replaying a run with a game's rules", () => {
  it("carries the rules' id and version", () => {
    expect(verifier.id).toBe("counter");
    expect(verifier.version).toBe(1);
  });

  it("reports what the rules say the run earned, once each", () => {
    expect(verifier.replay(record({ inputs: [add(3), add(2)] }))).toEqual({
      earned: ["reached", "exact"],
      ok: true,
    });
    expect(verifier.replay(record({ inputs: [add(3), add(3)] }))).toEqual({
      earned: ["reached"],
      ok: true,
    });
    expect(verifier.replay(record({ inputs: [add(1)] }))).toEqual({
      earned: [],
      ok: true,
    });
  });

  it("starts from the seed, so the same inputs under another seed can end differently", () => {
    const inputs = [add(2), add(2)];
    expect(verifier.replay(record({ inputs, seed: 0 })).ok).toBe(true);
    const odd = verifier.replay(
      record({ config: { target: 5 }, inputs, seed: 1 }),
    );
    expect(odd).toEqual({ earned: ["reached", "exact"], ok: true });
    expect(
      verifier.replay(record({ config: { target: 5 }, inputs, seed: 0 })),
    ).toEqual({
      earned: [],
      ok: true,
    });
  });

  it("refuses settings the game does not allow, before any input", () => {
    for (const target of [0, 101, 1.5, "5", null])
      expect(
        verifier.replay(record({ config: { target: target as never } })),
      ).toMatchObject({ index: null, ok: false, reason: "invalid-config" });
    expect(verifier.replay(record({ config: {} }))).toMatchObject({
      ok: false,
      reason: "invalid-config",
    });
  });

  it("stops at the first input that is not legal and says which it was", () => {
    expect(
      verifier.replay(record({ inputs: [add(1), add(9), add(1)] })),
    ).toEqual({
      detail: "add takes 1, 2 or 3",
      index: 1,
      ok: false,
      reason: "illegal-input",
    });
    expect(
      verifier.replay(record({ inputs: [{ type: "fly" }] })),
    ).toMatchObject({
      detail: "no such input: fly",
      index: 0,
      reason: "illegal-input",
    });
    expect(
      verifier.replay(record({ inputs: [{ type: "stop" }, add(1)] })),
    ).toMatchObject({ detail: "the run has stopped", index: 1 });
  });

  it("answers a verifier that fails as that, not as a verdict on the run, and never throws", () => {
    const crashing = defineVerifier(crashingRules);
    expect(
      crashing.replay(
        record({ inputs: [{ type: "anything" }], verifier: "crashing" }),
      ),
    ).toEqual({
      detail: "The verifier failed while replaying this run.",
      index: null,
      ok: false,
      reason: "verifier-error",
    });
  });
});
