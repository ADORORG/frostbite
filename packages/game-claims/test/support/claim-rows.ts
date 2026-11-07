import { randomUUID } from "node:crypto";

import { gameMilestoneClaims } from "@frostbite/database";

import { chain, contract, wallet } from "./fixture.ts";

export type Row = typeof gameMilestoneClaims.$inferInsert;
export const sentAt = new Date("2026-10-01T00:00:00.000Z");

// A claim row in the state given, with the fields that state requires (signed from `signed` on, sent from `broadcast` on).
export function claim(
  userId: string,
  gameId: string,
  state: "awaiting_signature" | "complete" | "expired" | "signed",
  over: Partial<Row> = {},
): Row {
  const signed = state === "complete" || state === "signed";
  const sent = state === "complete";
  return {
    broadcastAt: sent ? sentAt : null,
    chain,
    contractFamily: contract.family,
    contractId: contract.id,
    expectedClaims: 1,
    expiresAt: new Date("2026-10-02T00:00:00.000Z"),
    gameId,
    id: randomUUID(),
    // One claim of a milestone in progress at a time, per player: each row is its own milestone.
    milestoneId: `milestone-${randomUUID()}`,
    platformFeeSats: 0n,
    signedPayload: signed ? "signed" : null,
    state,
    summary: {},
    transactionId: sent ? randomUUID().replaceAll("-", "") : null,
    unsignedFamily: contract.family,
    unsignedFormat: "sim-json/1",
    unsignedPayload: "unsigned",
    updatedAt: sentAt,
    userId,
    walletAddress: wallet.value,
    ...over,
  };
}
