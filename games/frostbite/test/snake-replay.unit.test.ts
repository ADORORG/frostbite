import { replayRecord } from "@frostbite/game-sdk/replay";
import type { RunRecord } from "@frostbite/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import {
  frostbiteRules,
  frostbiteVerifierId,
  frostbiteVerifierVersion,
  snakeCabinetName,
} from "../src/verifier/frostbite.ts";
import { snakeTen, targetLength } from "../src/verifier/snake.ts";
import { playSnake, winnableSeed } from "./support/snake-solver.ts";

const seed = winnableSeed(targetLength);
const won = playSnake(seed, targetLength);
if (won === null) throw new Error("The test player could not win.");

const record = (over: Partial<RunRecord> = {}): RunRecord => ({
  claims: [snakeTen],
  config: { cabinet: snakeCabinetName },
  gameId: "frostbite",
  inputs: won.inputs.map((input) => ({ ...input })),
  schemaVersion: 1,
  seed,
  verifier: frostbiteVerifierId,
  verifierVersion: frostbiteVerifierVersion,
  ...over,
});

describe("a SAT SNAKE run, replayed", () => {
  it("is short: the record holds the player's turns, not every tick", () => {
    expect(won.inputs.length).toBeLessThan(won.state.tick);
    expect(won.inputs.at(-1)).toEqual({
      data: { tick: won.state.tick },
      type: "end",
    });
  });

  it("earns the milestone when the snake grows to the target length", () => {
    expect(replayRecord(frostbiteRules, record())).toEqual({
      earned: [snakeTen],
      ok: true,
    });
  });

  it("earns nothing when the last stretch is not closed with an end", () => {
    const open = record({ inputs: record().inputs.slice(0, -1) });
    const outcome = replayRecord(frostbiteRules, open);
    expect(outcome).toMatchObject({ ok: true });
    // Without the end, the snake is only followed to its last turn, which is before it ate the last food.
    expect(outcome.ok && outcome.earned).toEqual([]);
  });

  it("does not credit a run that is cut short", () => {
    const short = record({ inputs: record().inputs.slice(0, 3) });
    const outcome = replayRecord(frostbiteRules, short);
    expect(outcome.ok && outcome.earned).toEqual([]);
  });

  it("does not follow a run for a different seed", () => {
    const outcome = replayRecord(frostbiteRules, record({ seed: seed + 1 }));
    expect(!outcome.ok || outcome.earned.length === 0).toBe(true);
  });

  it("refuses the record of a snake that died and then turned", () => {
    const outcome = replayRecord(
      frostbiteRules,
      record({
        inputs: [
          { data: { dir: "up", tick: 0 }, type: "turn" },
          { data: { tick: 4_000 }, type: "end" },
          { data: { dir: "left", tick: 4_001 }, type: "turn" },
        ],
      }),
    );
    expect(outcome).toMatchObject({ ok: false, reason: "illegal-input" });
  });

  it("refuses a turn the snake could not make, saying which input", () => {
    const outcome = replayRecord(
      frostbiteRules,
      record({
        inputs: [{ data: { dir: "left", tick: 0 }, type: "turn" }],
      }),
    );
    expect(outcome).toEqual({
      detail: "the snake cannot turn back on itself",
      index: 0,
      ok: false,
      reason: "illegal-input",
    });
  });

  it("refuses a setting the cabinet does not have", () => {
    expect(
      replayRecord(
        frostbiteRules,
        record({ config: { cabinet: snakeCabinetName, speed: 9 } }),
      ),
    ).toMatchObject({
      detail: "no such setting: speed",
      reason: "invalid-config",
    });
  });

  it("is deterministic: the same record gives the same answer every time", () => {
    expect(replayRecord(frostbiteRules, record())).toEqual(
      replayRecord(frostbiteRules, record()),
    );
  });
});
