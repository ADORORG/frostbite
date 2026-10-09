import { z } from "zod";

import {
  outboxRelayPolicySchema,
  type OutboxRelayPolicy,
} from "./outbox-relay.ts";

const workflowPolicySchema = z
  .object({
    // Each media run buffers the source plus decoded pixels, so concurrency is bounded here.
    maxConcurrentMediaRuns: z.number().int().min(1).max(64),
    retries: z.number().int().min(0).max(20),
  })
  .strict();

export type WorkflowPolicy = z.infer<typeof workflowPolicySchema>;

export const defaultWorkflowPolicy: WorkflowPolicy = Object.freeze({
  maxConcurrentMediaRuns: 2,
  retries: 4,
});

export function resolveWorkflowPolicy(
  overrides: Partial<WorkflowPolicy> = {},
): WorkflowPolicy {
  return Object.freeze(
    workflowPolicySchema.parse({ ...defaultWorkflowPolicy, ...overrides }),
  );
}

export const drainLoopPolicySchema = z
  .object({
    errorDelayMs: z.number().int().positive(),
    idleDelayMs: z.number().int().positive(),
  })
  .strict();

export type DrainLoopPolicy = z.infer<typeof drainLoopPolicySchema>;
export const relayLoopPolicySchema = drainLoopPolicySchema;
export type RelayLoopPolicy = DrainLoopPolicy;

// Operational defaults for the standalone relay worker; typed and overridable, not env-bound.
export const defaultOutboxRelayPolicy: OutboxRelayPolicy = Object.freeze(
  outboxRelayPolicySchema.parse({
    batchSize: 10,
    leaseDurationMs: 60_000,
    maxAttempts: 8,
    retryBaseMs: 1_000,
    retryMaxMs: 300_000,
  }),
);

export const defaultRelayLoopPolicy: RelayLoopPolicy = Object.freeze(
  relayLoopPolicySchema.parse({ errorDelayMs: 5_000, idleDelayMs: 2_000 }),
);

// Housekeeping sweeps (abandoned uploads) have no latency target: eligibility is measured in hours, so
// they poll slowly and back off for a minute after a failure.
export const defaultMaintenanceLoopPolicy: DrainLoopPolicy = Object.freeze(
  drainLoopPolicySchema.parse({ errorDelayMs: 60_000, idleDelayMs: 300_000 }),
);
