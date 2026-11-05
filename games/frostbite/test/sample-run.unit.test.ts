import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import {
  cells,
  defaultMines,
  iceFieldMines,
} from "../src/verifier/ice-field.ts";
import {
  frostbiteRules,
  frostbiteVerifierId,
  frostbiteVerifierVersion,
} from "../src/verifier/frostbite.ts";
import { iceFieldSampleRun } from "../src/verifier/sample-run.ts";

describe("the sample run the verifier is registered with", () => {
  const run = iceFieldSampleRun();

  it("names this game's verifier, at this version, and its seed, settings and claims", () => {
    expect(run).toMatchObject({
      claims: ["first-win", "first-glacier"],
      config: { cabinet: "ice-field", mines: defaultMines },
      gameId: "frostbite",
      verifier: frostbiteVerifierId,
      verifierVersion: frostbiteVerifierVersion,
    });
  });

  it("is the same run every time it is built", () => {
    expect(iceFieldSampleRun()).toEqual(run);
  });

  it("picks every safe tile of the first board, settles it, and builds the first glacier", () => {
    const mines = iceFieldMines(run.seed, 0, defaultMines);
    const picks = run.inputs.filter(({ type }) => type === "pick");
    expect(picks).toHaveLength(cells - defaultMines);
    for (const { data } of picks) expect(mines).not.toContain(data);
    expect(run.inputs.slice(-2)).toEqual([
      { type: "settle" },
      { data: 1, type: "build-glacier" },
    ]);
  });

  it("is a legal run of the published rules that earns what it claims", () => {
    expect(replayRecord(frostbiteRules, run)).toEqual({
      earned: run.claims,
      ok: true,
    });
  });
});
