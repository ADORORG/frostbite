import { describe, expect, it } from "vitest";

import {
  gameClaimSchema,
  gameClaimStates,
  gameClaimUnavailableReasons,
  listGameClaimsResponseSchema,
  refreshGameClaimResponseSchema,
  startGameClaimInputSchema,
  startGameClaimResponseSchema,
  submitGameClaimInputSchema,
  submitGameClaimResponseSchema,
  startGameClaimRoute,
  submitGameClaimRoute,
  refreshGameClaimRoute,
  listGameClaimsRoute,
} from "../src/games/index.ts";

const id = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const transaction = {
  chain: "simnet:one",
  family: "simulated",
  format: "sim-json/1",
  payload: "{}",
};
const claim = {
  delayed: false,
  failureReason: null,
  gameId: "arcade",
  id,
  milestoneId: "first-win",
  sentAt: null,
  state: "awaiting-signature",
  summary: {
    chain: "simnet:one",
    contractId: "rewards-1",
    expiresAt: "2026-10-16T12:10:00.000Z",
    fee: { asset: "sim", baseUnits: "1" },
    milestoneId: "first-win",
    recipient: "sim:one:a1b2c3",
  },
  toSign: transaction,
  transactionId: null,
};
const accepts = (
  schema: { safeParse: (v: unknown) => { success: boolean } },
  v: unknown,
) => schema.safeParse(v).success;

describe("a claim as the page is told of it", () => {
  it("accepts a claim awaiting a signature, with what to sign, and one with nothing to sign", () => {
    expect(accepts(gameClaimSchema, claim)).toBe(true);
    expect(
      accepts(gameClaimSchema, {
        ...claim,
        state: "pending",
        toSign: null,
        transactionId: "abc",
      }),
    ).toBe(true);
  });

  it("says whether a claim is delayed and when it was sent, as a flag and a time, and refuses anything else", () => {
    const sent = {
      ...claim,
      delayed: true,
      sentAt: "2026-10-16T11:00:00.000Z",
      state: "pending",
      toSign: null,
      transactionId: "abc",
    };
    expect(accepts(gameClaimSchema, sent)).toBe(true);
    expect(accepts(gameClaimSchema, { ...sent, delayed: "yes" })).toBe(false);
    expect(accepts(gameClaimSchema, { ...sent, sentAt: "yesterday" })).toBe(
      false,
    );
    expect(accepts(gameClaimSchema, { ...sent, delayed: undefined })).toBe(
      false,
    );
  });

  it.each([
    ["a state that is not one", { state: "minted" }],
    ["an id that is not a uuid", { id: "1" }],
    ["a field it does not have", { wallet: "x" }],
    [
      "a fee that is not decimal text",
      { summary: { ...claim.summary, fee: { asset: "sim", baseUnits: "-1" } } },
    ],
    [
      "a fee as a number",
      { summary: { ...claim.summary, fee: { asset: "sim", baseUnits: 1 } } },
    ],
    [
      "a summary with a field it does not have",
      { summary: { ...claim.summary, extra: 1 } },
    ],
    [
      "a transaction with a field it does not have",
      { toSign: { ...transaction, extra: 1 } },
    ],
    ["a milestone id that is not an id", { milestoneId: "First Win" }],
  ])("refuses %s", (_name, change) => {
    expect(accepts(gameClaimSchema, { ...claim, ...change })).toBe(false);
  });

  it("names the six states and the twelve reasons a claim cannot start", () => {
    expect([...gameClaimStates]).toEqual([
      "awaiting-signature",
      "pending",
      "claimed",
      "complete",
      "failed",
      "expired",
    ]);
    expect([...gameClaimUnavailableReasons]).toEqual([
      "claims-paused",
      "contract-refused",
      "fee-too-high",
      "index-behind",
      "limit-reached",
      "milestone-not-defined",
      "no-funds",
      "no-wallet",
      "not-claimable",
      "not-earned",
      "not-supported",
      "unavailable",
      "wrong-network",
    ]);
  });
});

describe("starting a claim", () => {
  const input = {
    gameId: "arcade",
    milestoneId: "first-win",
    wallet: " sim:one:a1b2c3 ",
  };

  it("takes the speed the player chose, one of the four, and not any other", () => {
    for (const feeSpeed of ["slow", "medium", "fast", "lightning"])
      expect(
        startGameClaimInputSchema.parse({ ...input, feeSpeed }).feeSpeed,
      ).toBe(feeSpeed);
    expect(startGameClaimInputSchema.parse(input).feeSpeed).toBeUndefined();
    for (const feeSpeed of ["turbo", "", 3, null])
      expect(accepts(startGameClaimInputSchema, { ...input, feeSpeed })).toBe(
        false,
      );
  });

  it("takes the game, the milestone and the wallet's address, trimmed, and nothing else", () => {
    expect(startGameClaimInputSchema.parse(input).wallet).toBe(
      "sim:one:a1b2c3",
    );
    expect(accepts(startGameClaimInputSchema, { ...input, userId: "x" })).toBe(
      false,
    );
    expect(accepts(startGameClaimInputSchema, { ...input, wallet: "  " })).toBe(
      false,
    );
    expect(
      accepts(startGameClaimInputSchema, { ...input, wallet: "x".repeat(257) }),
    ).toBe(false);
    expect(
      accepts(startGameClaimInputSchema, { ...input, milestoneId: undefined }),
    ).toBe(false);
  });

  it("answers with the claim, or why there is none", () => {
    expect(
      accepts(startGameClaimResponseSchema, {
        claim,
        resumed: false,
        status: "started",
      }),
    ).toBe(true);
    for (const reason of gameClaimUnavailableReasons)
      expect(
        accepts(startGameClaimResponseSchema, {
          reason,
          status: "unavailable",
        }),
      ).toBe(true);
    expect(
      accepts(startGameClaimResponseSchema, {
        reason: "signed-out",
        status: "unavailable",
      }),
    ).toBe(false);
    expect(
      accepts(startGameClaimResponseSchema, { claim, status: "started" }),
    ).toBe(false);
  });
});

describe("submitting, refreshing and listing", () => {
  it("takes a claim id and what the wallet signed", () => {
    expect(
      accepts(submitGameClaimInputSchema, { claimId: id, signed: transaction }),
    ).toBe(true);
    expect(
      accepts(submitGameClaimInputSchema, {
        claimId: "x",
        signed: transaction,
      }),
    ).toBe(false);
    expect(
      accepts(submitGameClaimInputSchema, {
        claimId: id,
        signed: { chain: "simnet:one" },
      }),
    ).toBe(false);
  });

  it("answers with the claim as it stands, or a refusal naming why", () => {
    expect(
      accepts(submitGameClaimResponseSchema, { claim, status: "submitted" }),
    ).toBe(true);
    expect(
      accepts(submitGameClaimResponseSchema, {
        reason: "expired",
        status: "refused",
      }),
    ).toBe(true);
    expect(
      accepts(submitGameClaimResponseSchema, {
        reason: "because",
        status: "refused",
      }),
    ).toBe(false);
    expect(
      accepts(refreshGameClaimResponseSchema, { claim, status: "ok" }),
    ).toBe(true);
    expect(
      accepts(refreshGameClaimResponseSchema, {
        reason: "not-found",
        status: "refused",
      }),
    ).toBe(true);
    expect(
      accepts(refreshGameClaimResponseSchema, {
        reason: "expired",
        status: "refused",
      }),
    ).toBe(false);
    expect(accepts(listGameClaimsResponseSchema, { claims: [claim] })).toBe(
      true,
    );
    expect(
      accepts(listGameClaimsResponseSchema, {
        claims: [{ ...claim, state: "x" }],
      }),
    ).toBe(false);
  });

  it("are four routes under one path, each with its own operation id", () => {
    const routes = [
      startGameClaimRoute,
      submitGameClaimRoute,
      refreshGameClaimRoute,
      listGameClaimsRoute,
    ];
    // Listing is a GET; starting, submitting and refreshing change something.
    expect(routes.map(({ method }) => method)).toEqual([
      "POST",
      "POST",
      "POST",
      "GET",
    ]);
    expect(new Set(routes.map(({ path }) => path)).size).toBe(4);
    expect(new Set(routes.map(({ operationId }) => operationId)).size).toBe(4);
    for (const { path } of routes)
      expect(path.startsWith("/api/v1/games/claims/")).toBe(true);
  });
});
