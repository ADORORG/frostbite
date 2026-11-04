import type { ExpiredRowLimits } from "@ador/database";

// The platform's `expiredRowPolicy` as the limits a removal takes: just the numbers it uses, so a field a policy record carries for its own
// sake (its version) is never handed to a function that refuses what it does not know.
export function rowSweepLimitsOf(policy: {
  readonly batchSize: number;
  readonly contactCodeRetentionMs: number;
  readonly deliveredOutboxRetentionMs: number;
}): ExpiredRowLimits {
  return {
    batchSize: policy.batchSize,
    contactCodeRetentionMs: policy.contactCodeRetentionMs,
    deliveredOutboxRetentionMs: policy.deliveredOutboxRetentionMs,
  };
}
