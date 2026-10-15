import { runVerifierConformance } from "@ador/game-verification/conformance";
import { createVerifierRegistry } from "@ador/game-verification/registry";
import { defineVerifier } from "@ador/game-verification/verifier";
import { verifyRun } from "@ador/game-verification/verify";
import { describe, expect, it } from "vitest";

import { frostbite } from "../../../configs/games/frostbite.ts";
import { createIceFieldSession } from "../../../games/frostbite/src/ice-field/session.ts";
import {
  iceFieldMines,
  iceFieldRules,
} from "../../../games/frostbite/src/verifier/ice-field.ts";
import { iceFieldSampleRun } from "../../../games/frostbite/src/verifier/sample-run.ts";

// FROST·BITE's ice-field rules, as the platform would hold them once the game publishes them as an artifact (it does not
// yet: that is the game's adoption of the claim path). Built here from the rules themselves, so this file checks the cabinet's
// records against them; no part of the platform names the game.
const sample = iceFieldSampleRun();
const verifierRegistry = createVerifierRegistry([
  { gameId: "frostbite", sample, verifier: defineVerifier(iceFieldRules) },
]);

describe("FROST·BITE's ice-field rules as a verifier", () => {
  it("passes the conformance checks with its sample run", () => {
    const entry = verifierRegistry.find("frostbite");
    if (entry === undefined) throw new Error("Not registered");
    expect(runVerifierConformance(entry).filter(({ ok }) => !ok)).toEqual([]);
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
        claims: [...sample.claims, "first-cashout"],
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

// What the cabinet in the game records as a player plays, checked by the verifier the platform registered.
describe("a run played through the ice-field cabinet", () => {
  const seed = 7_070_707;
  const safe = (board: number) => {
    const mine = iceFieldMines(seed, board, 5);
    return Array.from({ length: 25 }, (_, tile) => tile).filter(
      (tile) => !mine.includes(tile),
    );
  };

  it("is verified, with what the cabinet claimed", () => {
    const session = createIceFieldSession({ seed });
    for (const tile of safe(0)) session.pick(tile);
    session.settle();
    session.buildGlacier();
    expect(verifyRun(verifierRegistry, session.record())).toMatchObject({
      earned: ["first-win", "first-glacier"],
      status: "verified",
    });
  });

  it("is verified when the run earned nothing, a busted board included", () => {
    const session = createIceFieldSession({ seed });
    session.pick(iceFieldMines(seed, 0, 5)[0] ?? 0);
    session.settle();
    expect(verifyRun(verifierRegistry, session.record())).toMatchObject({
      earned: [],
      status: "verified",
    });
  });

  it("is refused once it is changed to claim more than was played", () => {
    const session = createIceFieldSession({ seed });
    session.pick(safe(0)[0] ?? 0);
    const record = session.record();
    expect(
      verifyRun(verifierRegistry, { ...record, claims: ["first-win"] }),
    ).toMatchObject({
      reason: "claim-not-earned",
    });
    session.settle();
    const played = session.record();
    expect(
      verifyRun(verifierRegistry, {
        ...played,
        claims: [...played.claims, "first-glacier"],
      }),
    ).toMatchObject({
      reason: "claim-not-earned",
    });
  });

  it("is refused when a step is added that the board would not allow", () => {
    const session = createIceFieldSession({ seed });
    session.pick(iceFieldMines(seed, 0, 5)[0] ?? 0);
    const record = session.record();
    const forged = {
      ...record,
      inputs: [...record.inputs, { data: safe(0)[0], type: "pick" }],
    };
    expect(verifyRun(verifierRegistry, forged)).toMatchObject({
      detail: "the board is over: settle it",
      reason: "illegal-input",
    });
  });
});
