import type { GameAdminService } from "@frostbite/game-admin";
import { vi } from "vitest";

import {
  createListStepsOperation,
  createListTemplatesOperation,
  createRecordContractOperation,
  createRefreshStepOperation,
  createStartStepOperation,
  createSubmitStepOperation,
} from "../../src/application/operations.ts";
import type { GameAdminRuntime } from "../../src/runtime.ts";
import { chain, config, staffId, view } from "./fixtures.ts";

export const context = {
  actorSession: null,
  actorUserId: staffId as never,
  correlationId: "c0ffee00-0000-4000-8000-000000000000" as never,
};
export const anonymous = { ...context, actorUserId: null };

export function stub(overrides: Partial<GameAdminService> = {}) {
  const service: GameAdminService = {
    list: vi.fn(async () => [view()]),
    recordCreated: vi.fn(async () => ({ ok: true as const, step: view() })),
    status: vi.fn(async () => ({
      contract: { address: "rewards-1", maxDrawingBytes: 4096 },
      drawingCeiling: 8192,
      templatesReady: true,
    })),
    templates: vi.fn(async () => [
      {
        address: "at-1",
        codeHash: "a".repeat(64),
        publishedAt: new Date("2026-10-16T12:00:00.000Z"),
        templateRef: "game-rewards@1.0.0",
      },
    ]),
    refresh: vi.fn(async () => ({ ok: true as const, step: view() })),
    start: vi.fn(async () => ({
      ok: true as const,
      resumed: false,
      step: view(),
    })),
    submitSigned: vi.fn(async () => ({ ok: true as const, step: view() })),
    ...overrides,
  };
  const resolve = async (): Promise<GameAdminRuntime> => ({
    names: async () => new Map([[staffId, "Ada"]]),
    rewards: config().rewards,
    service,
  });
  return {
    list: createListStepsOperation(resolve),
    record: createRecordContractOperation(resolve),
    refresh: createRefreshStepOperation(resolve),
    service,
    start: createStartStepOperation(resolve),
    templates: createListTemplatesOperation(resolve),
    submit: createSubmitStepOperation(resolve),
  };
}
export const startInput = {
  action: { operation: "set-claims-paused", paused: true },
  gameId: "arcade",
  wallet: "sim:one:a1b2c3fe",
} as const;
export const signed = {
  chain,
  family: "simulated",
  format: "sim-json/1",
  payload: "{}.sig",
};
