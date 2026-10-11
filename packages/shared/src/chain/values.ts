import { z } from "zod";

import { chainFamilyIdSchema, chainRefSchema } from "./chain-ref.ts";

// A JSON value with no `unknown` in it. Family-specific extensions and adapter payload metadata use
// this type, so untrusted data stays typed until the owning adapter's own schema narrows it.
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

// Nesting is bounded, so a hostile payload fails validation with an ordinary error instead of
// overflowing the stack while it is being checked.
export const maxJsonDepth = 16;

function jsonValueUpTo(depth: number): z.ZodType<JsonValue> {
  const scalar = [z.string(), z.number(), z.boolean(), z.null()] as const;
  if (depth === 0) return z.union(scalar);
  const inner = jsonValueUpTo(depth - 1);
  return z.union([...scalar, z.array(inner), z.record(z.string(), inner)]);
}

export const jsonValueSchema: z.ZodType<JsonValue> =
  jsonValueUpTo(maxJsonDepth);

export const extensionSchema = z.record(z.string().min(1), jsonValueSchema);

// The text of an address is validated and canonicalised by the owning adapter's codec; this schema
// checks only structure and keeps the chain attached so an address cannot cross chains unnoticed.
export const addressSchema = z
  .object({
    chain: chainRefSchema,
    value: z.string().trim().min(1).max(256),
  })
  .strict()
  .readonly();

export const assetKindSchema = z.enum(["native", "fungible", "non-fungible"]);

export const assetRefSchema = z
  .object({
    chain: chainRefSchema,
    id: z.string().trim().min(1).max(128),
    kind: assetKindSchema,
  })
  .strict()
  .readonly();

export const amountSchema = z
  .object({
    asset: assetRefSchema,
    baseUnits: z.bigint().nonnegative(),
  })
  .strict()
  .readonly();

export const contractRefSchema = z
  .object({
    chain: chainRefSchema,
    family: chainFamilyIdSchema,
    id: z.string().trim().min(1).max(128),
  })
  .strict()
  .readonly();

export const finalitySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("confirmations"),
      required: z.number().int().min(1),
    })
    .strict(),
  z.object({ kind: z.literal("finalized") }).strict(),
]);

export const blockRefSchema = z
  .object({
    chain: chainRefSchema,
    hash: z.string().trim().min(1).max(128),
    height: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();

export const transactionRefSchema = z
  .object({
    chain: chainRefSchema,
    id: z.string().trim().min(1).max(128),
  })
  .strict()
  .readonly();

export type Address = z.infer<typeof addressSchema>;
export type AssetKind = z.infer<typeof assetKindSchema>;
export type AssetRef = z.infer<typeof assetRefSchema>;
export type Amount = z.infer<typeof amountSchema>;
export type ContractRef = z.infer<typeof contractRefSchema>;
export type Finality = z.infer<typeof finalitySchema>;
export type BlockRef = z.infer<typeof blockRefSchema>;
export type TransactionRef = z.infer<typeof transactionRefSchema>;
