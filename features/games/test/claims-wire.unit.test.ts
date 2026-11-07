import { gameClaimSchema } from "@frostbite/shared/games";
import { transactionSummarySchema } from "@frostbite/shared/chain";
import { describe, expect, it } from "vitest";

import { toWireClaim } from "../src/application/claims-operations.ts";
import { chain, summary, view } from "./support/claim-views.ts";

describe("a claim as the page is told of it", () => {
  it("is plain text throughout, with the player-facing state, and carries only the transaction to sign", () => {
    const wire = toWireClaim(view());
    expect(gameClaimSchema.safeParse(wire).success).toBe(true);
    expect(wire).toMatchObject({
      state: "awaiting-signature",
      summary: {
        contractId: "rewards-1",
        fee: { asset: "sim", baseUnits: "12345678901234567890" },
        recipient: "sim:one:a1b2c3fe",
      },
      toSign: {
        chain,
        family: "simulated",
        format: "sim-json/1",
        payload: "{}",
      },
    });
    expect(Object.keys(wire.toSign ?? {}).sort()).toEqual([
      "chain",
      "family",
      "format",
      "payload",
    ]);
  });

  it("carries when the claim was sent and whether its wait is delayed", () => {
    expect(toWireClaim(view())).toMatchObject({ delayed: false, sentAt: null });
    const wire = toWireClaim(
      view({
        delayed: true,
        sentAt: "2026-10-16T11:00:00.000Z",
        state: "broadcast_accepted",
        toSign: null,
      }),
    );
    expect(wire).toMatchObject({
      delayed: true,
      sentAt: "2026-10-16T11:00:00.000Z",
      state: "pending",
    });
    expect(gameClaimSchema.safeParse(wire).success).toBe(true);
  });

  it("names the state the player understands, and has nothing to sign once it is signed", () => {
    expect(
      toWireClaim(view({ state: "broadcast_accepted", toSign: null })),
    ).toMatchObject({
      state: "pending",
      toSign: null,
    });
    expect(
      toWireClaim(
        view({ state: "complete", toSign: null, transactionId: "abc" }),
      ),
    ).toMatchObject({
      state: "complete",
      transactionId: "abc",
    });
    expect(
      toWireClaim(
        view({
          failureReason: "reverted by the network",
          state: "indexed_failure",
          toSign: null,
        }),
      ),
    ).toMatchObject({
      failureReason: "reverted by the network",
      state: "failed",
    });
  });

  it("passes on how the fee came about when the builder said, and says nothing of it when it did not", () => {
    const detail = {
      approxMinutes: 60,
      satPerVb: 2.5,
      speed: "medium",
    } as const;
    const told = toWireClaim(
      view({ summary: { ...summary, feeDetail: detail } }),
    );
    expect(gameClaimSchema.parse(told).summary.feeDetail).toEqual(detail);
    expect(toWireClaim(view()).summary).not.toHaveProperty("feeDetail");
  });

  it("tells the platform's fee, and who it goes to, when the claim carries one, and nothing of it when it does not", () => {
    const recipient = { chain: summary.chain, value: "sim:one:7ea5a1ab" };
    const told = toWireClaim(
      view({
        summary: {
          ...summary,
          platformFee: {
            amount: { asset: summary.fee.asset, baseUnits: 1_500n },
            recipient,
          },
        },
      }),
    );
    expect(gameClaimSchema.parse(told).summary.platformFee).toEqual({
      baseUnits: "1500",
      recipient: recipient.value,
    });
    expect(toWireClaim(view()).summary).not.toHaveProperty("platformFee");
  });

  it("refuses a summary that does not name its milestone, which is not a claim", () => {
    const bare = transactionSummarySchema.parse({
      chain,
      expiresAt: summary.expiresAt,
      fee: summary.fee,
      operation: "mint-milestone",
    });
    expect(() => toWireClaim(view({ summary: bare }))).toThrow(
      "A claim's summary names the milestone it claims.",
    );
  });
});
