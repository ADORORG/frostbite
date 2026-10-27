import { gameClaimSchema, type GameClaim } from "@ador/shared/games";
import { vi } from "vitest";

import type { ClaimsApi } from "../../src/client/claims-api.ts";
import { flush, game, mount, send } from "./player-harness.tsx";

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
    delayed: false,
    failureReason: null,
    gameId: "embedded-game",
    id: claimId,
    milestoneId,
    sentAt: null,
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

// The chain's quotes for the four fee speeds, as the platform answers them.
export const fees = {
  api: {
    fees: async () => ({
      chain: "Bitcoin signet",
      maxFeeSats: 500_000,
      observedAt: new Date().toISOString(),
      quotes: [
        {
          approxMinutes: 250,
          satPerVb: 1.009,
          speed: "slow" as const,
          targetBlocks: 25,
          withinLimit: true,
        },
        {
          approxMinutes: 60,
          satPerVb: 3,
          speed: "medium" as const,
          targetBlocks: 6,
          withinLimit: true,
        },
        {
          approxMinutes: 30,
          satPerVb: 5,
          speed: "fast" as const,
          targetBlocks: 3,
          withinLimit: true,
        },
        {
          approxMinutes: 15,
          satPerVb: 9,
          speed: "lightning" as const,
          targetBlocks: 1,
          withinLimit: true,
        },
      ],
      state: "ok" as const,
      tipHeight: 157_401,
    }),
    indexing: () => Promise.reject(new Error("not used")),
  },
  defaultSpeed: "slow" as const,
  refreshMs: 60_000,
};

// A player whose game has earned the milestone, with the claim routes and wallet given.
export async function earned(
  claims: Parameters<typeof mount>[1] extends infer P
    ? P extends { claims?: infer C }
      ? C
      : never
    : never,
) {
  const mounted = await mount(undefined, { claims, game: claimGame });
  send(mounted.target, "ready", { sdkVersion: 1 }, "a");
  send(mounted.target, "milestones.unlock", { id: milestoneId }, "b");
  await flush();
  return mounted;
}
