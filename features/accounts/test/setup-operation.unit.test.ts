import { outcomeMessage } from "@frostbite/shared/account-outcomes";
import type { RedeemResult } from "@frostbite/authorization";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import {
  redeemSetupLinkRequestSchema,
  redeemSetupLinkResponseSchema,
} from "../src/setup/contract.ts";
import { createRedeemSetupLinkOperation } from "../src/setup/operation.ts";

const now = new Date("2026-10-25T12:00:00.000Z");
const session = {
  absoluteExpiresAt: new Date(now.getTime() + 60_000),
  authenticatedAt: now,
  idleExpiresAt: new Date(now.getTime() + 30_000),
  sessionId: createUuidV7(),
  userId: createUuidV7(),
};
const context = {
  actorSession: session,
  actorUserId: session.userId,
  correlationId: createUuidV7(),
};
const token = "A".repeat(43);

function operationAnswering(result: RedeemResult) {
  const redeem = vi.fn(async () => result);
  return {
    operation: createRedeemSetupLinkOperation(() => ({ redeem })),
    redeem,
  };
}

describe("redeeming a setup link over HTTP", () => {
  it("opens the link for the session's own account, never one the request names, and passes the correlation id on", async () => {
    const { operation, redeem } = operationAnswering({ kind: "granted" });
    expect(await operation.execute({ token }, context)).toEqual({
      ok: true,
      value: { status: "granted" },
    });
    expect(redeem).toHaveBeenCalledExactlyOnceWith({
      correlationId: context.correlationId,
      token,
      userId: session.userId,
    });
  });

  it("tells a retry by the same person that the link was already used by them", async () => {
    const { operation } = operationAnswering({ kind: "already-used-by-you" });
    expect(await operation.execute({ token }, context)).toEqual({
      ok: true,
      value: { status: "already-used-by-you" },
    });
  });

  it("gives one not-found answer for any link that cannot work, revealing nothing about why", async () => {
    const { operation } = operationAnswering({ kind: "invalid-link" });
    expect(await operation.execute({ token }, context)).toEqual({
      error: "not_found",
      message: outcomeMessage("setup-link-invalid"),
      ok: false,
      reason: "setup-link-invalid",
    });
  });

  it("asks for the missing sign-in methods by name, as a conflict the person can fix", async () => {
    const { operation } = operationAnswering({
      kind: "needs-method",
      missing: ["wallet", "passkey"],
    });
    expect(await operation.execute({ token }, context)).toEqual({
      error: "conflict",
      message:
        "Add a wallet and passkey sign-in method to this account first, then open the link again.",
      ok: false,
      reason: "setup-method-needed",
    });
  });

  it("refuses a request with no session without touching the service", async () => {
    const { operation, redeem } = operationAnswering({ kind: "granted" });
    expect(
      await operation.execute(
        { token },
        { ...context, actorSession: null, actorUserId: null },
      ),
    ).toMatchObject({ error: "unauthorized", ok: false });
    expect(redeem).not.toHaveBeenCalled();
  });

  it("declares every failure it can return, so the HTTP layer accepts them", () => {
    const { operation } = operationAnswering({ kind: "granted" });
    expect([...operation.applicationErrors].sort()).toEqual([
      "conflict",
      "not_found",
      "unauthorized",
    ]);
  });
});

describe("the redeem contract", () => {
  it("takes only a bounded token and nothing else", () => {
    expect(redeemSetupLinkRequestSchema.safeParse({ token }).success).toBe(
      true,
    );
    expect(redeemSetupLinkRequestSchema.safeParse({ token: "" }).success).toBe(
      false,
    );
    expect(
      redeemSetupLinkRequestSchema.safeParse({ token: "a".repeat(257) })
        .success,
    ).toBe(false);
    expect(
      redeemSetupLinkRequestSchema.safeParse({ extra: 1, token }).success,
    ).toBe(false);
  });

  it("answers with one of two statuses and nothing else", () => {
    expect(
      redeemSetupLinkResponseSchema.safeParse({ status: "granted" }).success,
    ).toBe(true);
    expect(
      redeemSetupLinkResponseSchema.safeParse({ status: "invalid-link" })
        .success,
    ).toBe(false);
  });
});
