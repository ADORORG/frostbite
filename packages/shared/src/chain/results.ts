import { z } from "zod";

import {
  amountSchema,
  blockRefSchema,
  contractRefSchema,
  transactionRefSchema,
} from "./values.ts";

export const chainTransactionSchema = z
  .object({
    block: blockRefSchema.optional(),
    ref: transactionRefSchema,
    status: z.enum(["unknown", "pending", "confirmed", "failed"]),
  })
  .strict()
  .readonly();

export const contractInspectionSchema = z
  .object({
    codeHash: z.string().trim().min(1).max(128).nullable(),
    exists: z.boolean(),
    ref: contractRefSchema,
  })
  .strict()
  .readonly();

export const simulationResultSchema = z.discriminatedUnion("ok", [
  z.object({ fee: amountSchema, ok: z.literal(true) }).strict(),
  z.object({ ok: z.literal(false), reason: z.string().trim().min(1) }).strict(),
]);

export const fundingPolicySchema = z
  .object({ maxFee: amountSchema })
  .strict()
  .readonly();

export const verificationResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }).strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        "payload-mismatch",
        "summary-mismatch",
        "signature-invalid",
      ]),
    })
    .strict(),
]);

// How a broadcast ended. `ambiguous` means the network may have received it: the transaction id is
// known and the caller reconciles by that id; it never re-signs or blindly retries (ADR-008).
export const broadcastOutcomeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("accepted"), ref: transactionRefSchema }).strict(),
  z
    .object({
      kind: z.literal("rejected"),
      reason: z.string().trim().min(1),
    })
    .strict(),
  z.object({ kind: z.literal("unavailable") }).strict(),
  z
    .object({ kind: z.literal("ambiguous"), ref: transactionRefSchema })
    .strict(),
]);

// Append-only evidence: where and when a provider saw the transaction.
export const observationSchema = z
  .object({
    block: blockRefSchema.optional(),
    confirmations: z.number().int().nonnegative(),
    // The contracts the transaction created, in order, in the chain's own notation: how a game's contract is learned once the step
    // that makes it has run.
    created: z.array(z.string().trim().min(1).max(128)).readonly().optional(),
    observedAt: z.iso.datetime(),
    provider: z.string().trim().min(1).max(64),
    ref: transactionRefSchema,
    status: z.enum(["not-found", "pending", "confirmed", "reverted"]),
  })
  .strict()
  .readonly();

// What a page shows for a collectible a claim produced: the picture the chain serves for it, who issued it and its edition
// number. The issuer lets the platform check the item came from a game it lists, because anyone can create look-alike items.
export const collectiblePreviewSchema = z
  .object({
    bytes: z.instanceof(Uint8Array),
    contentType: z.string().trim().min(1).max(128),
    edition: z.number().int().positive(),
    issuer: contractRefSchema,
  })
  .strict()
  .readonly();

export type ChainTransaction = z.infer<typeof chainTransactionSchema>;
export type CollectiblePreview = z.infer<typeof collectiblePreviewSchema>;
export type ContractInspection = z.infer<typeof contractInspectionSchema>;
export type SimulationResult = z.infer<typeof simulationResultSchema>;
export type FundingPolicy = z.infer<typeof fundingPolicySchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type BroadcastOutcome = z.infer<typeof broadcastOutcomeSchema>;
export type Observation = z.infer<typeof observationSchema>;
