import { chainRefSchema, type ContractRef } from "@frostbite/shared/chain";
import { defineGame } from "@frostbite/shared/games";
import type { StepView } from "@frostbite/game-admin";
import { transactionSummarySchema } from "@frostbite/shared/chain";

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
// How complex a drawing may be, as configuration states it and as the log reports it.
export const drawingLimits = {
  maxAttributeLength: 4096,
  maxDepth: 8,
  maxElements: 200,
};

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
  tags: ["arcade"],
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
  tags: ["arcade"],
  title: "Plain",
  version: "1",
});

export const gameTemplate = { id: "game-rewards", version: "1.0.0" };
export const collectibleTemplate = {
  id: "milestone-collectible",
  version: "1.0.0",
};

export const config = (): GameAdminConfig => ({
  chain: () => null,
  delay: { maxLagBlocks: 2, maxUnsettledMs: 60 * 60_000 },
  explorerTxUrl: "https://explorer.test/tx/{id}",
  fees: {
    defaultSpeed: "slow",
    polling: { forgetAfterMs: 600_000, refreshMs: 60_000 },
  },
  drawingLimits,
  rewards: {
    chain,
    collectibleTemplate,
    family: "simulated" as ContractRef["family"],
    gameTemplate,
    maxDrawingBytes: 8192n,
    publishable: [gameTemplate, collectibleTemplate],
  },
  platformFee: { maximumSats: 100_000n },
  signingWallets: ["xverse"],
});

export const info = () => adminGames([game, plainGame]);

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
  createdContracts: [],
  delayed: false,
  expiresAt: "2026-10-16T12:10:00.000Z",
  failureReason: null,
  gameId,
  id: "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60",
  milestoneId: null,
  operation: "set-claims-paused",
  recordable: false,
  recordedBy: null,
  sentAt: null,
  state: "awaiting_signature",
  submittedBy: null,
  summary: summary(),
  templateRef: null,
  toSign: {
    chain,
    family: "simulated" as never,
    format: "sim-json/1",
    payload: "{}",
    summary: summary(),
  },
  transactionId: null,
  transactions: [],
  unconfirmedSend: false,
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

const codeHash = "a".repeat(64);
const at = (id: string) => ({ ...contract, id });

// What staff are shown to publish a template at `at-1`.
export const publishSummary = (over: { at?: ContractRef | undefined } = {}) =>
  transactionSummarySchema.parse({
    chain,
    expiresAt: "2026-10-16T12:10:00.000Z",
    fee: { asset: { chain, id: "sim", kind: "native" }, baseUnits: 1n },
    operation: "publish-template",
    template: {
      at: "at" in over ? over.at : at("at-1"),
      codeHash,
      id: "game-rewards",
      version: "1.0.0",
    },
  });

// What staff are shown to create a game's contract from templates published at `at-1` and `at-2`.
export const deploySummary = () =>
  transactionSummarySchema.parse({
    chain,
    collectibleAt: at("at-2"),
    expiresAt: "2026-10-16T12:10:00.000Z",
    fee: { asset: { chain, id: "sim", kind: "native" }, baseUnits: 1n },
    maxDrawingBytes: 4096,
    operation: "deploy",
    template: {
      at: at("at-1"),
      codeHash,
      id: "game-rewards",
      version: "1.0.0",
    },
  });
