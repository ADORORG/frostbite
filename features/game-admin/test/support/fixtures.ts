import { chainRefSchema, type ContractRef } from "@ador/shared/chain";
import { defineGame } from "@ador/shared/games";
import type { StepView } from "@ador/game-admin";
import { transactionSummarySchema } from "@ador/shared/chain";

import type { GameAdminConfig } from "../../src/config.ts";
import { adminGames } from "../../src/game-info.ts";

export const chain = chainRefSchema.parse("simnet:one");
export const gameId = "arcade";
export const contract: ContractRef = {
  chain,
  family: "simulated" as ContractRef["family"],
  id: "rewards-1",
};
export const staffId = "0198a000-0000-7000-8000-000000000001";
export const otherStaffId = "0198a000-0000-7000-8000-000000000002";

export const game = defineGame({
  capabilities: ["milestone:claim"],
  description: "",
  id: gameId,
  launch: { mode: "embedded" },
  milestones: [
    {
      claimPolicy: "once",
      criteria: "Win.",
      description: "You won.",
      id: "first-win",
      title: "First win",
    },
    {
      claimPolicy: "repeatable",
      criteria: "Win often.",
      description: "You won a lot.",
      id: "streak",
      maxCount: 3,
      title: "Streak",
    },
  ],
  network: chain,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  schemaVersion: 1,
  summary: "A game.",
  title: "Arcade",
  version: "1",
});

// A game that declares no rewards: unknown to administration.
export const plainGame = defineGame({
  capabilities: [],
  description: "",
  id: "plain",
  launch: { mode: "embedded" },
  milestones: [],
  network: chain,
  schemaVersion: 1,
  summary: "A game.",
  title: "Plain",
  version: "1",
});

export const config = (deployed = true): GameAdminConfig => ({
  chain: () => null,
  contracts: deployed ? new Map([[gameId, contract]]) : new Map(),
  drawingLimits: { maxAttributeLength: 4096, maxDepth: 8, maxElements: 200 },
  maxDrawingBytes: new Map([[gameId, 4096n]]),
});

export const info = (deployed = true) =>
  adminGames([game, plainGame], config(deployed));

const summary = (extra: object = {}) =>
  transactionSummarySchema.parse({
    chain,
    contract,
    expiresAt: "2026-10-16T12:10:00.000Z",
    fee: { asset: { chain, id: "sim", kind: "native" }, baseUnits: 1n },
    operation: "set-claims-paused",
    paused: true,
    ...extra,
  });

export const view = (over: Partial<StepView> = {}): StepView => ({
  createdAt: "2026-10-16T12:00:00.000Z",
  createdBy: staffId,
  expiresAt: "2026-10-16T12:10:00.000Z",
  failureReason: null,
  gameId,
  id: "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60",
  milestoneId: null,
  operation: "set-claims-paused",
  state: "awaiting_signature",
  submittedBy: null,
  summary: summary(),
  toSign: {
    chain,
    family: "simulated" as never,
    format: "sim-json/1",
    payload: "{}",
    summary: summary(),
  },
  transactionId: null,
  ...over,
});

export const defineSummary = () =>
  summary({
    claimLimit: 1,
    drawing: { bytes: 6, sha256: "a".repeat(64) },
    milestone: { contract, id: "first-win" },
    operation: "define-milestone",
    paused: undefined,
  });
