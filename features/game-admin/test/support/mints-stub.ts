import { vi } from "vitest";

import {
  createGetPlatformFeeOperation,
  createListGameMintsOperation,
  createListGameMintTotalsOperation,
  createSetPlatformFeeOperation,
} from "../../src/application/mints.ts";
import type { GameAdminRuntime } from "../../src/runtime.ts";
import { chain, config, info, otherStaffId, staffId } from "./fixtures.ts";

export const claimId = "0198a000-0000-7000-8000-0000000000c1";
export const at = new Date("2026-10-16T12:00:00.000Z");
export const treasury = "sim:one:7ea5a1ab";

// The services the mint and fee operations read, as fakes the test can answer or inspect.
// `answers` replaces what a service answers, before the operations are made over it.
export function mintsStub(
  answers: {
    readonly change?: GameAdminRuntime["fees"]["change"];
    readonly names?: Map<string, string>;
    readonly recent?: GameAdminRuntime["mints"]["recent"];
    readonly totalsFor?: GameAdminRuntime["mints"]["totalsFor"];
    readonly view?: GameAdminRuntime["fees"]["view"];
  } = {},
) {
  const mints: GameAdminRuntime["mints"] = {
    recent: vi.fn(
      answers.recent ??
        (async () => ({
          mints: [
            {
              claimId,
              completedAt: at,
              milestoneId: "first-win",
              platformFeeSats: 1_500n,
              transactionId: "ab".repeat(16),
              userId: "0198a000-0000-7000-8000-0000000000u1",
              walletAddress: "sim:one:a1b2c3fe",
            },
          ],
          next: { claimId, completedAt: at },
        })),
    ),
    totalsFor: vi.fn(
      answers.totalsFor ??
        (async (ids: readonly string[]) =>
          ids.map((gameId) => ({
            completed: 3,
            feesAccruedSats: 4_500n,
            gameId,
            inProgress: 1,
          }))),
    ),
  };
  const fees: GameAdminRuntime["fees"] = {
    change: vi.fn(
      answers.change ??
        (async (_staff, _chain, input) => ({
          change: {
            changedAt: at,
            changedBy: staffId,
            chain,
            feeSats: input.feeSats,
            id: claimId,
            treasury: input.treasury,
          },
          ok: true as const,
        })),
    ),
    setting: vi.fn(async () => null),
    view: vi.fn(
      answers.view ??
        (async () => ({
          current: {
            changedAt: at,
            changedBy: staffId,
            chain,
            feeSats: 1_500n,
            id: claimId,
            treasury,
          },
          history: [
            {
              changedAt: new Date(at.getTime() - 3_600_000),
              changedBy: otherStaffId,
              chain,
              feeSats: 1_000n,
              id: claimId,
              treasury,
            },
            {
              changedAt: new Date(at.getTime() - 7_200_000),
              changedBy: null,
              chain,
              feeSats: 0n,
              id: claimId,
              treasury,
            },
          ],
          maximumFeeSats: 100_000n,
        })),
    ),
  };
  const resolve = async (): Promise<GameAdminRuntime> => ({
    fees,
    drawingLimits: config().drawingLimits,
    games: info(),
    mints,
    names: async () =>
      answers.names ??
      new Map([
        [staffId, "Ada"],
        [otherStaffId, "Grace"],
      ]),
    rewards: config().rewards,
    service: {
      list: vi.fn(),
      recordCreated: vi.fn(),
      refresh: vi.fn(),
      start: vi.fn(),
      status: vi.fn(),
      submitSigned: vi.fn(),
      templates: vi.fn(),
    },
  });
  return {
    fees,
    list: createListGameMintsOperation(resolve),
    mints,
    platformFee: createGetPlatformFeeOperation(resolve),
    set: createSetPlatformFeeOperation(resolve),
    totals: createListGameMintTotalsOperation(resolve),
  };
}
