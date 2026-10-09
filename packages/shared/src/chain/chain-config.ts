import { z } from "zod";

import { chainFamilyIdSchema, chainRefSchema } from "./chain-ref.ts";
import { finalitySchema } from "./values.ts";

export const chainRoles = ["test", "public-beta", "production"] as const;

// Operations the platform performs on a chain. A confirmation policy is required for each one, so
// a chain cannot be enabled with an operation whose finality nobody decided (D22).
export const chainOperations = ["deploy", "mint", "transfer"] as const;

export const chainRoleSchema = z.enum(chainRoles);
export const chainOperationSchema = z.enum(chainOperations);

// `closed` keeps a configured chain from production broadcast until its release gate is opened
// (ADR-008's mainnet rule, applied per chain). A `test` chain does not need the gate.
export const releaseGateSchema = z.enum(["closed", "open"]);

export const chainConfigSchema = z
  .object({
    chainId: chainRefSchema,
    confirmations: z.record(chainOperationSchema, finalitySchema),
    displayName: z.string().trim().min(1).max(64),
    enabled: z.boolean(),
    family: chainFamilyIdSchema,
    releaseGate: releaseGateSchema,
    role: chainRoleSchema,
  })
  .strict()
  .readonly();

export const chainConfigListSchema = z
  .array(chainConfigSchema)
  .refine(
    (chains) =>
      new Set(chains.map(({ chainId }) => chainId)).size === chains.length,
    "Chain ids must be unique.",
  )
  .readonly();

export type ChainRole = z.infer<typeof chainRoleSchema>;
export type ChainOperation = z.infer<typeof chainOperationSchema>;
export type ChainConfig = z.infer<typeof chainConfigSchema>;
