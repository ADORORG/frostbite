import { describe, expect, it } from "vitest";

import {
  cells,
  defaultMines,
  iceFieldMines,
  iceFieldRules,
  iceFieldVerifierId,
  iceFieldVersion,
  type IceFieldState,
} from "../src/verifier/ice-field.ts";
import { iceFieldSampleRun } from "../src/verifier/sample-run.ts";

describe("the sample run the verifier is registered with", () => {
  const run = iceFieldSampleRun();

  it("names this game's verifier, at this version, and its seed, settings and claims", () => {
    expect(run).toMatchObject({
      claims: ["first-win", "first-glacier"],
      config: { mines: defaultMines },
      gameId: "frostbite",
      verifier: iceFieldVerifierId,
      verifierVersion: iceFieldVersion,
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

  it("is a legal run of the rules that earns what it claims", () => {
    const started = iceFieldRules.init(run.seed, run.config);
    if (!started.ok) throw new Error(started.reason);
    let state: IceFieldState = started.state;
    for (const input of run.inputs) {
      const stepped = iceFieldRules.step(state, input);
      if (!stepped.ok) throw new Error(stepped.reason);
      state = stepped.state;
    }
    expect(iceFieldRules.earned(state)).toEqual(run.claims);
  });
});
