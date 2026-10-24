import { ApiError } from "@ador/client-http";
import type { GameAdminStep } from "@ador/shared/games";
import { vi } from "vitest";

import type { GameAdminApi } from "../../src/client/api.ts";

export const stepId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
export const step = (over: Partial<GameAdminStep> = {}): GameAdminStep => ({
  createdAt: "2026-10-16T12:00:00.000Z",
  createdBy: "Ada",
  createdContracts: [],
  delayed: false,
  failureReason: null,
  gameId: "arcade",
  id: stepId,
  operation: "set-claims-paused",
  recordable: false,
  recordedBy: null,
  sentAt: null,
  state: "awaiting-signature",
  submittedBy: null,
  templateRef: null,
  summary: {
    chain: "simnet:one",
    contractId: "rewards-1",
    expiresAt: "2026-10-16T12:10:00.000Z",
    fee: { asset: "sim", baseUnits: "1" },
    paused: true,
  },
  toSign: {
    chain: "simnet:one",
    family: "simulated",
    format: "sim-json/1",
    payload: "{}",
  },
  transactionId: null,
  transactions: [],
  unconfirmedSend: false,
  ...over,
});

export const defining = (over: Partial<GameAdminStep> = {}) =>
  step({
    operation: "define-milestone",
    summary: {
      chain: "simnet:one",
      claimLimit: 1,
      contractId: "rewards-1",
      drawing: { bytes: 6, sha256: "a".repeat(64) },
      expiresAt: "2026-10-16T12:10:00.000Z",
      fee: { asset: "sim", baseUnits: "1" },
      milestoneId: "first-win",
    },
    ...over,
  });

export const publishing = (over: Partial<GameAdminStep> = {}) =>
  step({
    gameId: null,
    operation: "publish-template",
    summary: {
      chain: "simnet:one",
      expiresAt: "2026-10-16T12:10:00.000Z",
      fee: { asset: "sim", baseUnits: "1" },
      template: { address: "at-1", id: "game-rewards", version: "1.0.0" },
    },
    templateRef: "game-rewards@1.0.0",
    ...over,
  });

export const creating = (over: Partial<GameAdminStep> = {}) =>
  step({
    operation: "deploy",
    summary: {
      chain: "simnet:one",
      collectibleAddress: "at-2",
      expiresAt: "2026-10-16T12:10:00.000Z",
      fee: { asset: "sim", baseUnits: "1" },
      maxDrawingBytes: 4096,
      template: { address: "at-1", id: "game-rewards", version: "1.0.0" },
    },
    ...over,
  });

export const publishable = [
  { id: "game-rewards", version: "1.0.0" },
  { id: "milestone-collectible", version: "1.0.0" },
];

// What the list route answers for a game that has its contract.
export const listing = (steps: GameAdminStep[]) => ({
  contract: { address: "rewards-1", maxDrawingBytes: 4096 },
  drawingCeiling: 8192,
  steps,
  templatesReady: true,
});

// An API that answers from what a test gives it, and remembers what it was asked.
export function fakeApi(overrides: Partial<GameAdminApi> = {}) {
  const api: GameAdminApi = {
    list: vi.fn(async () => listing([])),
    record: vi.fn(async () => ({
      status: "recorded" as const,
      step: step({ createdContracts: ["2:7"], state: "complete" }),
    })),
    refresh: vi.fn(async () => ({ status: "ok" as const, step: step() })),
    start: vi.fn(async () => ({
      resumed: false,
      status: "started" as const,
      step: step(),
    })),
    submit: vi.fn(async () => ({
      status: "submitted" as const,
      step: step({ state: "pending", toSign: null, transactionId: "abc" }),
    })),
    templates: vi.fn(async () => ({ publishable, published: [], steps: [] })),
    ...overrides,
  };
  return api;
}

export const apiError = (
  code: ConstructorParameters<typeof ApiError>[0],
  correlationId: string | null = null,
) => new ApiError(code, null, "failed", correlationId);
