import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { directions, lastFloor, maxMoves } from "../src/rules/constants.ts";
import { mazeRules } from "../src/rules/index.ts";
import { earnedBy, milestoneIds } from "../src/rules/milestones.ts";
import { scout, wanderer, type Result } from "./support/bots.ts";

// The game measured with two players: one who sees every cell (the scout), who must always get out; and one who sees only what the lantern
// lit, and remembers it perfectly, who must usually not. The first proves the game is fair, the second that it is hard.
const seeds = Array.from({ length: 12 }, (_, index) => (index + 1) * 7_919);
const timed = <T>(make: () => T): T => make();

describe("the game, played whole", () => {
  const scouts = seeds.map((seed) => timed(() => scout(seed)));
  const greedy = seeds.map((seed) => timed(() => scout(seed, true)));
  const wanderers = seeds.map((seed) => timed(() => wanderer(seed)));

  it("is always escaped by a player who sees the whole cellar and takes the shortest way, in far fewer steps than a record holds", () => {
    for (const { state } of scouts) {
      expect(state.cause).toBe("escaped");
      expect(state.floorsCleared).toBe(lastFloor);
      expect(state.moves).toBeLessThan(maxMoves * 0.8);
    }
  });

  it("is escaped by a player who also detours for oil, within the steps a record holds", () => {
    expect(greedy.every(({ state }) => state.cause === "escaped")).toBe(true);
    expect(greedy.every(({ state }) => state.moves <= maxMoves)).toBe(true);
  });

  it("is rarely escaped by a player who sees only what the lantern has lit", () => {
    const floors = wanderers
      .map(({ state }) => state.floorsCleared)
      .sort((a, b) => a - b);
    expect(
      floors.filter((count) => count >= lastFloor).length,
    ).toBeLessThanOrEqual(2);
    expect(floors[Math.floor(floors.length / 2)]).toBeGreaterThanOrEqual(8);
    expect(floors[Math.floor(floors.length / 2)]).toBeLessThanOrEqual(22);
    expect(wanderers.some(({ state }) => state.cause === "dark")).toBe(true);
  });

  it("can earn every milestone, between the players", () => {
    const all = new Set<string>();
    for (const { state } of [...scouts, ...greedy, ...wanderers])
      for (const id of earnedBy(state)) all.add(id);
    expect(milestoneIds.filter((id) => !all.has(id))).toEqual([]);
  });

  it("makes records the platform's replay accepts, whoever plays", () => {
    const record = (result: Result, seed: number) => ({
      claims: [...earnedBy(result.state)],
      config: {},
      gameId: "lantern-maze",
      inputs: [
        ...result.steps.map((step) => ({ type: directions[step] ?? "up" })),
        ...(result.state.ended ? [] : [{ type: "end" }]),
      ],
      schemaVersion: 1 as const,
      seed,
      verifier: "lantern-maze",
      verifierVersion: 1,
    });
    for (const [index, result] of [
      scouts[0],
      greedy[1],
      wanderers[2],
    ].entries()) {
      if (result === undefined) throw new Error("no result");
      const seed = [seeds[0], seeds[1], seeds[2]][index] ?? 0;
      const made = record(result, seed);
      expect(replayRecord(mazeRules, made)).toEqual({
        earned: made.claims,
        ok: true,
      });
      expect(made.inputs.length).toBeLessThanOrEqual(5_000);
    }
  });
});
