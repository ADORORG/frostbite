import { z } from "zod";

import {
  chainFamilyIdTextSchema,
  chainRefTextSchema,
} from "../chain/chain-ref.ts";
import { feeDetailSchema } from "../chain/fees.ts";
import { gameIdSchema } from "./manifest.ts";

// Where a step stands (the lifecycle's stages; a test keeps the lists equal).
export const gameAdminStepStates = [
  "awaiting-signature",
  "complete",
  "confirmed",
  "expired",
  "failed",
  "pending",
] as const;

// The transaction as it crosses the page: the one staff sign, and the same once signed. Plain text throughout.
export const gameAdminTransactionSchema = z
  .object({
    chain: chainRefTextSchema,
    family: chainFamilyIdTextSchema,
    format: z.string().trim().min(1).max(64),
    payload: z.string().min(1).max(262_144),
  })
  .strict();

// What staff are shown before signing: what the step does, on which contract or template, for what fee, until when.
export const gameAdminSummarySchema = z
  .object({
    chain: z.string().min(1).max(64),
    claimLimit: z.number().int().positive().optional(),
    // Where the template its collectibles are made from was published, for a step that creates a game's contract.
    collectibleAddress: z.string().min(1).max(128).optional(),
    // The contract the step acts on; publishing a template or creating a game's contract acts on none yet.
    contractId: z.string().min(1).max(128).optional(),
    drawing: z
      .object({
        bytes: z.number().int().nonnegative(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/u),
      })
      .strict()
      .optional(),
    expiresAt: z.iso.datetime({ offset: true }),
    fee: z
      .object({
        asset: z.string().min(1).max(128),
        baseUnits: z.string().regex(/^\d{1,40}$/u),
      })
      .strict(),
    // The rate and speed the fee was priced at, when the adapter priced it by rate.
    feeDetail: feeDetailSchema.optional(),
    // The most drawing the contract being created will accept.
    maxDrawingBytes: z.number().int().positive().optional(),
    milestoneId: gameIdSchema.optional(),
    paused: z.boolean().optional(),
    // The template being published, or the one the game is made from, and where it is or will be published.
    template: z
      .object({
        address: z.string().min(1).max(128).optional(),
        id: z.string().min(1).max(64),
        version: z.string().min(1).max(64),
      })
      .strict()
      .optional(),
  })
  .strict();

const person = z.string().min(1).max(200).nullable();

export const gameAdminStepSchema = z
  .object({
    createdAt: z.iso.datetime({ offset: true }),
    createdBy: person,
    failureReason: z.string().min(1).max(256).nullable(),
    // The contracts the chain reported the step created, once it ran: where a new game's contract is.
    createdContracts: z.array(z.string().min(1).max(128)).max(8),
    // Sent and waiting longer than expected, or waiting on an indexer that is far behind. Never a statement that the step failed.
    delayed: z.boolean(),
    // The game the step is about; none when it publishes a template.
    gameId: gameIdSchema.nullable(),
    id: z.uuid(),
    operation: z.enum([
      "define-milestone",
      "deploy",
      "publish-template",
      "set-claims-paused",
    ]),
    // Whether staff can enter where the contract this step made is, which the platform could not read from the confirmed transaction.
    recordable: z.boolean(),
    // Who entered the contract's address, when the chain did not report it and staff had to.
    recordedBy: person,
    // When the step was sent to the network; none before.
    sentAt: z.iso.datetime({ offset: true }).nullable(),
    state: z.enum(gameAdminStepStates),
    submittedBy: person,
    summary: gameAdminSummarySchema,
    // `id@version`, for a step that publishes a template.
    templateRef: z.string().min(1).max(130).nullable(),
    toSign: gameAdminTransactionSchema.nullable(),
    transactionId: z.string().min(1).max(128).nullable(),
  })
  .strict();

export type GameAdminStep = z.infer<typeof gameAdminStepSchema>;
export type GameAdminStepState = (typeof gameAdminStepStates)[number];
export type GameAdminSummary = z.infer<typeof gameAdminSummarySchema>;
export type GameAdminTransaction = z.infer<typeof gameAdminTransactionSchema>;
