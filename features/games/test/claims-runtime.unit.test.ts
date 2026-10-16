import { contractRefSchema } from "@ador/shared/chain";
import { defineGame } from "@ador/shared/games";
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
const config = (deployed: boolean) => ({
  chain: () => null,
  contracts: deployed ? new Map([["arcade", contract]]) : new Map(),
});

describe("what the claims service knows of a game", () => {
  it("is the game's chain, its deployed contract, and each milestone's claim limit from its own policy", () => {
    const lookup = claimableGameLookup([withRewards, without], config(true));
    expect(lookup("arcade")).toEqual({
      chain,
      contract,
      limits: new Map([
        ["first-win", 1],
        ["streak", 5],
      ]),
    });
  });

  it("has no contract for a game none is deployed for, though the game declares rewards", () => {
    expect(
      claimableGameLookup([withRewards], config(false))("arcade"),
    ).toMatchObject({
      contract: null,
      limits: new Map([
        ["first-win", 1],
        ["streak", 5],
      ]),
    });
  });

  it("knows nothing of a game that declares no rewards, or of a game that is not listed", () => {
    const lookup = claimableGameLookup([withRewards, without], config(true));
    expect(lookup("plain")).toBeNull();
    expect(lookup("unlisted")).toBeNull();
  });
});
