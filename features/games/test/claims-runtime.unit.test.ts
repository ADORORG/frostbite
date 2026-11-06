import { contractRefSchema } from "@frostbite/shared/chain";
import { defineGame } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import { claimableGameLookup } from "../src/claims-runtime.ts";

const chain = "simnet:one";
const contract = contractRefSchema.parse({
  chain,
  family: "simulated",
  id: "rewards-1",
});
const milestone = {
  claimPolicy: "once",
  criteria: "Win.",
  description: "You won.",
  id: "first-win",
  title: "First win",
} as const;
const streak = {
  claimPolicy: "repeatable",
  criteria: "Win again.",
  description: "You won again.",
  id: "streak",
  maxCount: 5,
  title: "Streak",
} as const;
const base = {
  capabilities: [],
  description: "",
  launch: { mode: "embedded" as const },
  network: chain,
  schemaVersion: 1 as const,
  summary: "A game.",
  tags: ["arcade" as const],
  title: "A game",
  version: "1",
};
const withRewards = defineGame({
  ...base,
  id: "arcade",
  milestones: [{ ...milestone }, { ...streak }],
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
});
const without = defineGame({
  ...base,
  id: "plain",
  milestones: [{ ...milestone }],
});
// The record of contracts, which holds the game's contract on the chain once it was created.
const record = (deployed: boolean) => {
  const asked: [string, string][] = [];
  return {
    asked,
    gameContract: (gameId: string, onChain: string) => {
      asked.push([gameId, onChain]);
      return Promise.resolve(
        deployed && gameId === "arcade"
          ? { address: "rewards-1", family: "simulated", maxDrawingBytes: 4096 }
          : null,
      );
    },
  };
};

describe("what the claims service knows of a game", () => {
  it("is the game's chain, its contract as recorded, and each milestone's claim limit from its own policy", async () => {
    const contracts = record(true);
    const lookup = claimableGameLookup([withRewards, without], contracts);
    expect(await lookup("arcade")).toEqual({
      chain,
      contract,
      limits: new Map([
        ["first-win", 1],
        ["streak", 5],
      ]),
    });
    expect(contracts.asked).toEqual([["arcade", chain]]);
  });

  it("has no contract for a game none was created for, though the game declares rewards", async () => {
    expect(
      await claimableGameLookup([withRewards], record(false))("arcade"),
    ).toMatchObject({
      contract: null,
      limits: new Map([
        ["first-win", 1],
        ["streak", 5],
      ]),
    });
  });

  it("knows nothing of a game that declares no rewards, or of a game that is not listed, and does not ask the record", async () => {
    const contracts = record(true);
    const lookup = claimableGameLookup([withRewards, without], contracts);
    expect(await lookup("plain")).toBeNull();
    expect(await lookup("unlisted")).toBeNull();
    expect(contracts.asked).toEqual([]);
  });
});
