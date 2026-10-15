import { runVerifierConformance } from "@ador/game-verification/conformance";
import { verifyRun } from "@ador/game-verification/verify";
import { describe, expect, it } from "vitest";

import { frostbite } from "../../../configs/games/frostbite.ts";
import { verifierRegistry } from "../../../configs/verifiers.ts";

const frostbiteEntry = verifierRegistry.find("ice-field");
const sample = frostbiteEntry?.sample;

describe("the verifiers the platform registers", () => {
  it("are the ones reviewed here: FROST·BITE's ice field, for the game of that id", () => {
    expect(verifierRegistry.ids()).toEqual(["ice-field"]);
    expect(frostbiteEntry?.gameId).toBe(frostbite.id);
  });

  it("each pass the conformance checks with the sample run they were registered with", () => {
    for (const id of verifierRegistry.ids()) {
      const entry = verifierRegistry.find(id);
      if (entry === undefined) throw new Error(`No verifier ${id}`);
      const failed = runVerifierConformance(entry).filter(({ ok }) => !ok);
      expect(failed).toEqual([]);
    }
  });

  it("can only earn milestones the game's manifest declares", () => {
    const declared = frostbite.milestones.map(({ id }) => id);
    const result = verifyRun(verifierRegistry, sample);
    if (result.status !== "verified") throw new Error(result.detail);
    expect(result.earned.length).toBeGreaterThan(0);
    for (const id of result.earned) expect(declared).toContain(id);
  });
});

describe("replay verification of FROST·BITE's ice field", () => {
  it("verifies the sample run: a cleared board, settled, and the first glacier built", () => {
    expect(verifyRun(verifierRegistry, sample)).toMatchObject({
      earned: ["first-win", "first-glacier"],
      status: "verified",
    });
  });

  it("does not verify first-cashout, which is a simulation event the rules cannot decide", () => {
    expect(
      verifyRun(verifierRegistry, {
        ...sample,
        claims: [...(sample?.claims ?? []), "first-cashout"],
      }),
    ).toMatchObject({ reason: "claim-not-earned", status: "rejected" });
  });

  it("refuses a glacier the icicles do not pay for", () => {
    const poor = {
      ...sample,
      claims: ["first-glacier"],
      inputs: [{ data: 1, type: "build-glacier" }],
    };
    expect(verifyRun(verifierRegistry, poor)).toMatchObject({
      detail: "not enough icicles for that tier",
      reason: "illegal-input",
    });
  });

  it("is bound to the seed: the same picks on another board hit mines and are refused", () => {
    const other = { ...sample, seed: (sample?.seed ?? 0) + 1 };
    expect(verifyRun(verifierRegistry, other)).toMatchObject({
      reason: "illegal-input",
      status: "rejected",
    });
  });

  it("gives the same digest for the same run, and another for the smallest change", () => {
    const first = verifyRun(verifierRegistry, sample);
    const again = verifyRun(
      verifierRegistry,
      JSON.parse(JSON.stringify(sample)),
    );
    expect(again).toEqual(first);
    const changed = verifyRun(verifierRegistry, {
      ...sample,
      claims: ["first-win"],
    });
    expect(changed.status).toBe("verified");
    expect(changed.digest).not.toBe(first.digest);
  });
});
