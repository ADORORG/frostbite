import { createRunRecorder } from "@frostbite/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import { createVerifierRegistry } from "../src/registry.ts";
import { defineVerifier } from "../src/verifier.ts";
import { verifyRun } from "../src/verify.ts";
import { counterRules, counterSample } from "./counter-game.ts";

// The whole path a run takes: a game records it as it plays, the record travels as JSON text, and the platform checks
// what arrives.
const registry = createVerifierRegistry([
  {
    gameId: "counting",
    sample: counterSample,
    verifier: defineVerifier(counterRules),
  },
]);
const play = (
  moves: readonly number[],
  claims: readonly string[],
  seed = 0,
) => {
  const recorder = createRunRecorder({
    config: { target: 6 },
    gameId: "counting",
    seed,
    verifier: "counter",
    verifierVersion: 1,
  });
  for (const move of moves) recorder.input("add", move);
  recorder.input("stop");
  return recorder.finish(claims);
};
const overTheWire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value));

describe("a run from the game to the platform", () => {
  it("is verified when the game played it and claimed what it earned", () => {
    const result = verifyRun(
      registry,
      overTheWire(play([3, 3], ["reached", "exact"])),
    );
    expect(result).toMatchObject({
      earned: ["reached", "exact"],
      status: "verified",
    });
  });

  it("is refused when a game claims a result its inputs do not reach", () => {
    expect(
      verifyRun(registry, overTheWire(play([3, 2], ["reached"]))),
    ).toMatchObject({
      reason: "claim-not-earned",
      status: "rejected",
    });
  });

  it("is refused when the record is changed on the way: the claim, the seed, a move or the settings", () => {
    const honest = play([3, 3], ["reached"]);
    const tampered = [
      { ...honest, claims: ["reached", "exact", "perfect"] },
      { ...honest, seed: 1 },
      { ...honest, config: { target: 1 } },
      { ...honest, inputs: [{ data: 9, type: "add" }, ...honest.inputs] },
    ].map(overTheWire);
    // Only the changed seed and settings still replay to something legal, and none of them is verified as the original.
    const original = verifyRun(registry, overTheWire(honest));
    expect(original.status).toBe("verified");
    for (const record of tampered) {
      const result = verifyRun(registry, record);
      if (result.status === "verified" && original.status === "verified")
        expect(result.digest).not.toBe(original.digest);
    }
    expect(verifyRun(registry, tampered[0]).status).toBe("rejected");
    expect(verifyRun(registry, tampered[3]).status).toBe("rejected");
  });

  it("is the same run, with the same digest, each time it is replayed", () => {
    const record = overTheWire(play([3, 3], ["reached"]));
    expect(verifyRun(registry, record)).toEqual(verifyRun(registry, record));
  });
});
