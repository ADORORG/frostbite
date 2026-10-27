import type { GameClaimsService } from "@ador/game-claims";
import { signedTransactionSchema } from "@ador/shared/chain";
import {
  listGameClaimsRoute,
  refreshGameClaimRoute,
  startGameClaimRoute,
  submitGameClaimRoute,
} from "@ador/shared/games";
import { describe, expect, it, vi } from "vitest";

import {
  createListGameClaimsOperation,
  createRefreshGameClaimOperation,
  createStartGameClaimOperation,
  createSubmitGameClaimOperation,
} from "../src/application/claims-operations.ts";
import {
  anonymous,
  chain,
  claimId,
  context,
  userId,
  view,
} from "./support/claim-views.ts";

function stub(overrides: Partial<GameClaimsService> = {}) {
  const service: GameClaimsService = {
    list: vi.fn(async () => [view()]),
    minted: vi.fn(async () => []),
    picture: vi.fn(async () => ({
      code: "no-picture" as const,
      ok: false as const,
    })),
    refresh: vi.fn(async () => ({ claim: view(), ok: true as const })),
    start: vi.fn(async () => ({
      claim: view(),
      ok: true as const,
      resumed: false,
    })),
    submitSigned: vi.fn(async () => ({ claim: view(), ok: true as const })),
    ...overrides,
  };
  const get = async () => service;
  return {
    list: createListGameClaimsOperation(get),
    refresh: createRefreshGameClaimOperation(get),
    service,
    start: createStartGameClaimOperation(get),
    submit: createSubmitGameClaimOperation(get),
  };
}
const startInput = {
  gameId: "arcade",
  milestoneId: "first-win",
  wallet: "sim:one:a1b2c3fe",
};
const signed = signedTransactionSchema.parse({
  chain,
  family: "simulated",
  format: "sim-json/1",
  payload: "{}.sig",
});

describe("every claim operation", () => {
  it("is an authenticated, keyless POST on its contract route", () => {
    const s = stub();
    for (const [operation, route] of [
      [s.start, startGameClaimRoute],
      [s.submit, submitGameClaimRoute],
      [s.refresh, refreshGameClaimRoute],
      [s.list, listGameClaimsRoute],
    ] as const)
      expect(operation).toMatchObject({
        access: { kind: "authenticated" },
        idempotency: "none",
        method: route.method,
        operationId: route.operationId,
        path: route.path,
      });
  });

  it("refuses an anonymous caller without touching the service", async () => {
    const s = stub();
    for (const [run, input] of [
      [() => s.start.execute(startInput, anonymous), "start"],
      [() => s.submit.execute({ claimId, signed }, anonymous), "submitSigned"],
      [() => s.refresh.execute({ claimId }, anonymous), "refresh"],
      [() => s.list.execute({ gameId: "arcade" }, anonymous), "list"],
    ] as const) {
      expect(await run()).toMatchObject({ error: "unauthorized", ok: false });
      expect(s.service[input]).not.toHaveBeenCalled();
    }
  });
});

describe("starting a claim", () => {
  it("starts it for the session's own user with the wallet the page gave, and answers with the claim", async () => {
    const s = stub();
    const result = await s.start.execute(startInput, context);
    expect(result).toMatchObject({
      ok: true,
      value: { resumed: false, status: "started" },
    });
    expect(s.service.start).toHaveBeenCalledWith({
      gameId: "arcade",
      milestoneId: "first-win",
      userId,
      wallet: "sim:one:a1b2c3fe",
    });
    await s.start.execute({ ...startInput, feeSpeed: "fast" }, context);
    expect(s.service.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ feeSpeed: "fast" }),
    );
  });

  it("says a claim already open was resumed", async () => {
    const s = stub({
      start: async () => ({ claim: view(), ok: true, resumed: true }),
    });
    expect(await s.start.execute(startInput, context)).toMatchObject({
      value: { resumed: true, status: "started" },
    });
  });

  it.each([
    ["not-claimable", "not-claimable"],
    ["unavailable", "not-supported"],
    ["wrong-chain", "wrong-network"],
    ["not-earned", "not-earned"],
    ["limit-reached", "limit-reached"],
    ["chain-unavailable", "unavailable"],
    ["claims-paused", "claims-paused"],
    ["contract-refused", "contract-refused"],
    ["fee-too-high", "fee-too-high"],
    ["index-behind", "index-behind"],
    ["milestone-not-defined", "milestone-not-defined"],
    ["no-funds", "no-funds"],
  ] as const)(
    "answers, not fails, for %s with the reason %s",
    async (code, reason) => {
      const s = stub({ start: async () => ({ code, ok: false }) });
      expect(await s.start.execute(startInput, context)).toEqual({
        ok: true,
        value: { reason, status: "unavailable" },
      });
    },
  );
});

describe("submitting, refreshing and listing", () => {
  it("passes what the wallet signed for the session's own user, and answers with the claim", async () => {
    const s = stub();
    expect(await s.submit.execute({ claimId, signed }, context)).toMatchObject({
      value: { status: "submitted" },
    });
    expect(s.service.submitSigned).toHaveBeenCalledWith({
      claimId,
      signed,
      userId,
    });
  });

  it.each([
    "chain-unavailable",
    "expired",
    "not-awaiting-signature",
    "not-found",
  ] as const)("answers a refusal of a submission for %s", async (code) => {
    const s = stub({ submitSigned: async () => ({ code, ok: false }) });
    expect(await s.submit.execute({ claimId, signed }, context)).toEqual({
      ok: true,
      value: { reason: code, status: "refused" },
    });
  });

  it("answers an invalid signature without saying how it was invalid", async () => {
    const s = stub({
      submitSigned: async () => ({
        code: "invalid-signature",
        ok: false,
        reason: "payload-mismatch",
      }),
    });
    const result = await s.submit.execute({ claimId, signed }, context);
    expect(result).toEqual({
      ok: true,
      value: { reason: "invalid-signature", status: "refused" },
    });
    expect(JSON.stringify(result)).not.toContain("payload-mismatch");
  });

  it("answers how a claim stands, or why it cannot be looked at", async () => {
    const s = stub();
    expect(await s.refresh.execute({ claimId }, context)).toMatchObject({
      value: { status: "ok" },
    });
    expect(s.service.refresh).toHaveBeenCalledWith(userId, claimId);
    for (const code of ["chain-unavailable", "not-found"] as const) {
      const refused = stub({ refresh: async () => ({ code, ok: false }) });
      expect(await refused.refresh.execute({ claimId }, context)).toEqual({
        ok: true,
        value: { reason: code, status: "refused" },
      });
    }
  });

  it("lists the session's own user's claims for the game", async () => {
    const s = stub({
      list: vi.fn(async () => [
        view(),
        view({ id: "7b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b61" }),
      ]),
    });
    const result = await s.list.execute({ gameId: "arcade" }, context);
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.value.claims).toHaveLength(2);
    expect(s.service.list).toHaveBeenCalledWith(userId, "arcade");
  });
});
