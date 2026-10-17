import { z } from "zod";

import { gameAdminStepSchema } from "./admin-step.ts";

// Staff enter where a game's contract was made, when the confirmed transaction did not let the platform read it. The platform checks
// that a contract is there, made from the game template, before it records it.
export const recordGameAdminContractInputSchema = z
  .object({
    // The contract's address in the chain's own notation.
    address: z.string().trim().min(1).max(128),
    stepId: z.uuid(),
  })
  .strict();
export const gameAdminRecordRefusals = [
  "address-taken",
  "already-created",
  "chain-unavailable",
  "different-code",
  "not-found",
  "not-on-chain",
  "not-recordable",
] as const;
export const recordGameAdminContractResponseSchema = z.discriminatedUnion(
  "status",
  [
    z
      .object({ status: z.literal("recorded"), step: gameAdminStepSchema })
      .strict(),
    z
      .object({
        reason: z.enum(gameAdminRecordRefusals),
        status: z.literal("refused"),
      })
      .strict(),
  ],
);

export type RecordGameAdminContractInput = z.infer<
  typeof recordGameAdminContractInputSchema
>;
export type RecordGameAdminContractResponse = z.infer<
  typeof recordGameAdminContractResponseSchema
>;
