import type { ExpiredRowLimits } from "@ador/database";

// Limits for tests that build a worker runtime but do not exercise the row sweeps' numbers: small, and valid for the removal.
export const rowSweepLimits: ExpiredRowLimits = {
  batchSize: 10,
  contactCodeRetentionMs: 3_600_000,
  deliveredOutboxRetentionMs: 604_800_000,
};
