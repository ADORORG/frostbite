import {
  maxRunInputs,
  maxRunRecordBytes,
} from "@frostbite/game-sdk/run-record";
import { z } from "zod";

// What the platform allows of a run record it is asked to replay, as typed policy: changing a value is a
// configuration change, not a release. A record is hostile input, so these bound the work before any replay starts.
// They may be lower than the SDK's ceilings, never higher.
export const verificationPolicySchema = z
  .object({
    // The most inputs one record may hold, so a replay is at most this many steps.
    maxInputs: z.int().min(1).max(maxRunInputs),
    // The most the canonical text of a record may be, in bytes.
    maxRecordBytes: z.int().min(256).max(maxRunRecordBytes),
    // The longest one replay may run, in milliseconds. A game's rules that run longer are stopped and the replay fails.
    replayTimeoutMs: z.int().min(50).max(10_000),
  })
  .strict();
export type VerificationPolicy = z.infer<typeof verificationPolicySchema>;

export const defaultVerificationPolicy: VerificationPolicy = Object.freeze({
  maxInputs: maxRunInputs,
  maxRecordBytes: maxRunRecordBytes,
  replayTimeoutMs: 2_000,
});

export function resolveVerificationPolicy(
  overrides: Partial<VerificationPolicy> = {},
): VerificationPolicy {
  return Object.freeze(
    verificationPolicySchema.parse({
      ...defaultVerificationPolicy,
      ...overrides,
    }),
  );
}
