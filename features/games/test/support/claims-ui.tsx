import { gameClaimSchema, type GameClaim } from "@ador/shared/games";
import { vi } from "vitest";

import type { ClaimsApi } from "../../src/client/claims-api.ts";
import { flush, game } from "./player-harness.tsx";

// What the claim UI tests share: a claim as the routes answer, a fake of the routes, and a wallet.
export const claimId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
export const milestoneId = game.milestones[0]?.id ?? "";
export const claimGame = { ...game, capabilities: ["milestone:claim"] };
export const wallet = {
  address: "tb1pexampleexampleexample0001",
  network: "signet",
};
export const toSign = {
  chain: "simnet:one",
  family: "simulated",
  format: "sim-json/1",
  payload: "{}",
};

export const claimAt = (
  state: GameClaim["state"],
  over: Partial<GameClaim> = {},
): GameClaim =>
  gameClaimSchema.parse({
    failureReason: null,
    gameId: "embedded-game",
    id: claimId,
    milestoneId,
    state,
    summary: {
      chain: "simnet:one",
      contractId: "rewards-1",
      expiresAt: "2026-10-16T12:10:00.000Z",
      fee: { asset: "sim", baseUnits: "12" },
      milestoneId,
      recipient: wallet.address,
    },
    toSign: state === "awaiting-signature" ? toSign : null,
    transactionId: state === "awaiting-signature" ? null : "abc",
    ...over,
  });

export function fakeApi(over: Partial<ClaimsApi> = {}) {
  const api: ClaimsApi = {
    list: vi.fn(async () => ({ claims: [] })),
    refresh: vi.fn(async () => ({
      claim: claimAt("pending"),
      status: "ok" as const,
    })),
    start: vi.fn(async () => ({
      claim: claimAt("awaiting-signature"),
      resumed: false,
      status: "started" as const,
    })),
    submit: vi.fn(async () => ({
      claim: claimAt("pending"),
      status: "submitted" as const,
    })),
    ...over,
  };
  return api;
}

// Waits, a little at a time, for something the page does on its own (a poll), without waiting for the clock.
export async function until(condition: () => boolean, tries = 40) {
  for (let attempt = 0; attempt < tries && !condition(); attempt += 1)
    await flush();
}
