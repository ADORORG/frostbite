import type { FetchLike } from "@ador/client-http";
import { gameClaimSchema, type GameClaim } from "@ador/shared/games";
import { describe, expect, it, vi } from "vitest";

import { createClaimsService } from "../src/client/claims-port.ts";

const claimId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status });
const denied = (code: string, status: number) =>
  json(
    {
      error: {
        code,
        correlationId: "01890f0e-7c8a-7b3a-8a3e-0123456789ab",
        message: "No.",
      },
    },
    status,
  );
const claim: GameClaim = gameClaimSchema.parse({
  failureReason: null,
  gameId: "arcade",
  id: claimId,
  milestoneId: "first-win",
  state: "awaiting-signature",
  summary: {
    chain: "simnet:one",
    contractId: "rewards-1",
    expiresAt: "2026-10-16T12:10:00.000Z",
    fee: { asset: "sim", baseUnits: "1" },
    milestoneId: "first-win",
    recipient: "sim:one:a1b2c3fe",
  },
  toSign: {
    chain: "simnet:one",
    family: "simulated",
    format: "sim-json/1",
    payload: "{}",
  },
  transactionId: null,
});
const wallet = { address: "sim1one1a1b2c3fe1111", network: "signet" };

function setup(
  answer: () => Response | Promise<Response>,
  connected = wallet as typeof wallet | null,
) {
  const fetchImpl = vi.fn<FetchLike>(async () => answer());
  const onStarted = vi.fn<(started: GameClaim) => void>();
  const service = createClaimsService({
    fetch: fetchImpl,
    gameId: "arcade",
    onStarted,
    wallet: () => connected,
  });
  return { fetchImpl, onStarted, service };
}

describe("asking for a claim from the page", () => {
  it("posts the game, the milestone and the connected wallet's address, shows the claim, and says it was requested", async () => {
    const { fetchImpl, onStarted, service } = setup(() =>
      json({ claim, resumed: false, status: "started" }),
    );
    expect(await service.claim("first-win")).toEqual({ status: "requested" });
    const [path, init] = fetchImpl.mock.calls[0] ?? [];
    expect(path).toBe("/api/v1/games/claims/start");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body ?? "")).toEqual({
      gameId: "arcade",
      milestoneId: "first-win",
      wallet: wallet.address,
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(onStarted).toHaveBeenCalledExactlyOnceWith(claim);
  });

  it("says there is no wallet without asking the platform", async () => {
    const { fetchImpl, onStarted, service } = setup(() => json({}), null);
    expect(await service.claim("first-win")).toEqual({
      reason: "no-wallet",
      status: "unavailable",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onStarted).not.toHaveBeenCalled();
  });

  it("says claims are not supported when the page has nowhere to show a claim, without asking the platform", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json({}));
    const service = createClaimsService({
      fetch: fetchImpl,
      gameId: "arcade",
      wallet: () => wallet,
    });
    expect(await service.claim("first-win")).toEqual({
      reason: "not-supported",
      status: "unavailable",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    "limit-reached",
    "not-claimable",
    "not-earned",
    "not-supported",
    "unavailable",
    "wrong-network",
  ] as const)("passes on why a claim is unavailable: %s", async (reason) => {
    const { onStarted, service } = setup(() =>
      json({ reason, status: "unavailable" }),
    );
    expect(await service.claim("first-win")).toEqual({
      reason,
      status: "unavailable",
    });
    expect(onStarted).not.toHaveBeenCalled();
  });

  it("says the player is signed out when there is no session", async () => {
    const { onStarted, service } = setup(() => denied("unauthorized", 401));
    expect(await service.claim("first-win")).toEqual({
      reason: "signed-out",
      status: "unavailable",
    });
    expect(onStarted).not.toHaveBeenCalled();
  });

  it("lets any other failure through, so the host tells the game the platform was unavailable", async () => {
    const { onStarted, service } = setup(() => denied("internal", 500));
    await expect(service.claim("first-win")).rejects.toThrow();
    const broken = setup(() => json({ status: "started" }));
    await expect(broken.service.claim("first-win")).rejects.toThrow();
    expect(onStarted).not.toHaveBeenCalled();
  });
});
