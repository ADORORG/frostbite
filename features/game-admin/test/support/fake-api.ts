import { ApiError } from "@ador/client-http";
import type { GameAdminStep } from "@ador/shared/games";
import { vi } from "vitest";

import type { GameAdminApi } from "../../src/client/api.ts";

export const stepId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
export const step = (over: Partial<GameAdminStep> = {}): GameAdminStep => ({
  createdAt: "2026-10-16T12:00:00.000Z",
  createdBy: "Ada",
  failureReason: null,
  gameId: "arcade",
  id: stepId,
  operation: "set-claims-paused",
  state: "awaiting-signature",
  submittedBy: null,
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

// An API that answers from what a test gives it, and remembers what it was asked.
export function fakeApi(overrides: Partial<GameAdminApi> = {}) {
  const api: GameAdminApi = {
    list: vi.fn(async () => ({ steps: [] })),
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
    ...overrides,
  };
  return api;
}

export const apiError = (code: ConstructorParameters<typeof ApiError>[0]) =>
  new ApiError(code, null, "failed");
