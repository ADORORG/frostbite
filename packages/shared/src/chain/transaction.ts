import { z } from "zod";

import { chainFamilyIdSchema, chainRefSchema } from "./chain-ref.ts";
import { chainOperationSchema, type ChainOperation } from "./chain-config.ts";
import {
  addressSchema,
  amountSchema,
  assetRefSchema,
  contractRefSchema,
  extensionSchema,
} from "./values.ts";

// A milestone's id as a game declares it: lower-case words joined by hyphens (the same form as a game's own id).
export const milestoneIdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

const semanticVersionPattern = /^\d+\.\d+\.\d+$/u;

// Chain-neutral fields every intent shares. Anything family-specific (UTXO funding, gas settings)
// goes in `extension`, which the owning adapter validates with its own schema.
const intentBase = {
  chain: chainRefSchema,
  extension: extensionSchema.optional(),
  sender: addressSchema,
};

export const transactionIntentSchema = z
  .discriminatedUnion("operation", [
    z
      .object({
        ...intentBase,
        operation: z.literal("deploy"),
        templateId: z.string().trim().min(1).max(64),
        templateVersion: z.string().regex(semanticVersionPattern),
      })
      .strict(),
    z
      .object({
        ...intentBase,
        contract: contractRefSchema,
        operation: z.literal("mint"),
        quantity: z.bigint().positive(),
      })
      .strict(),
    // A player claims a milestone they earned from a game's rewards contract. The milestone is named by the id the game
    // declared; the contract decides how many claims one address may make.
    z
      .object({
        ...intentBase,
        contract: contractRefSchema,
        milestoneId: milestoneIdSchema,
        operation: z.literal("mint-milestone"),
      })
      .strict(),
    z
      .object({
        ...intentBase,
        amount: amountSchema,
        operation: z.literal("transfer"),
        recipient: addressSchema,
      })
      .strict(),
  ])
  .superRefine((intent, context) => {
    const embedded = [
      intent.sender.chain,
      ...(intent.operation === "mint" || intent.operation === "mint-milestone"
        ? [intent.contract.chain]
        : []),
      ...(intent.operation === "transfer"
        ? [intent.recipient.chain, intent.amount.asset.chain]
        : []),
    ];
    if (embedded.some((chain) => chain !== intent.chain)) {
      context.addIssue({
        code: "custom",
        message:
          "Every reference in an intent must belong to the intent's chain.",
      });
    }
  })
  .readonly();

// What the person is shown before they sign (ADR-008, plan 8.6). It is neutral and human-checkable;
// the adapter owns the native detail.
export const transactionSummarySchema = z
  .object({
    amount: amountSchema.optional(),
    asset: assetRefSchema.optional(),
    chain: chainRefSchema,
    expiresAt: z.iso.datetime(),
    fee: amountSchema,
    // Which milestone, from which contract, a `mint-milestone` transaction claims: what the person checks before signing.
    milestone: z
      .object({ contract: contractRefSchema, id: milestoneIdSchema })
      .strict()
      .optional(),
    operation: chainOperationSchema,
    recipient: addressSchema.optional(),
  })
  .strict()
  .superRefine((summary, context) => {
    const embedded = [
      summary.fee.asset.chain,
      ...(summary.amount ? [summary.amount.asset.chain] : []),
      ...(summary.asset ? [summary.asset.chain] : []),
      ...(summary.recipient ? [summary.recipient.chain] : []),
      ...(summary.milestone ? [summary.milestone.contract.chain] : []),
    ];
    if (embedded.some((chain) => chain !== summary.chain)) {
      context.addIssue({
        code: "custom",
        message:
          "Every reference in a summary must belong to the summary's chain.",
      });
    }
  })
  .readonly();

// The payload is opaque text (an encoding the adapter chooses). Only the adapter and the matching
// wallet bridge read it; everything else reads the summary.
const payloadFields = {
  chain: chainRefSchema,
  family: chainFamilyIdSchema,
  format: z.string().trim().min(1).max(64),
  payload: z.string().min(1),
};

export const unsignedTransactionSchema = z
  .object({ ...payloadFields, summary: transactionSummarySchema })
  .strict()
  .refine(
    ({ chain, summary }) => summary.chain === chain,
    "The summary must describe the transaction's own chain.",
  )
  .readonly();

export const signedTransactionSchema = z
  .object(payloadFields)
  .strict()
  .readonly();

export type TransactionIntent = z.infer<typeof transactionIntentSchema>;

// Compile-time check that the operations a chain needs a confirmation policy for are exactly the
// operations an intent can carry; adding one without the other fails the type check.
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const operationsAgree: Mutual<
  ChainOperation,
  TransactionIntent["operation"]
> = true;
export type TransactionSummary = z.infer<typeof transactionSummarySchema>;
export type UnsignedTransaction = z.infer<typeof unsignedTransactionSchema>;
export type SignedTransaction = z.infer<typeof signedTransactionSchema>;
