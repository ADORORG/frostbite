import type { ClaimView } from "@ador/game-claims";
import {
  addressSchema,
  transactionSummarySchema,
  unsignedTransactionSchema,
} from "@ador/shared/chain";
import { idempotencyKeySchema } from "@ador/shared/http";
import { uuidV7Schema } from "@ador/shared/identifiers";

export const userId = uuidV7Schema.parse(
  "01890f0e-7c8a-7b3a-8a3e-0123456789ab",
);
export const context = {
  actorSession: null,
  actorUserId: userId,
  correlationId: userId,
  idempotencyKey: idempotencyKeySchema.parse("request-key-00000001"),
};
export const anonymous = { ...context, actorUserId: null };
export const claimId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
export const chain = "simnet:one";
export const contract = { chain, family: "simulated", id: "rewards-1" };
export const wallet = addressSchema.parse({ chain, value: "sim:one:a1b2c3fe" });
export const summary = transactionSummarySchema.parse({
  chain,
  expiresAt: "2026-10-16T12:10:00.000Z",
  fee: {
    asset: { chain, id: "sim", kind: "native" },
    baseUnits: 12_345_678_901_234_567_890n,
  },
  milestone: { contract, id: "first-win" },
  operation: "mint-milestone",
  recipient: wallet,
});
export const toSign = unsignedTransactionSchema.parse({
  chain,
  family: "simulated",
  format: "sim-json/1",
  payload: "{}",
  summary,
});
export const view = (over: Partial<ClaimView> = {}): ClaimView => ({
  delayed: false,
  expiresAt: summary.expiresAt,
  failureReason: null,
  gameId: "arcade",
  id: claimId,
  milestoneId: "first-win",
  sentAt: null,
  state: "awaiting_signature",
  summary,
  toSign,
  transactionId: null,
  wallet,
  ...over,
});
