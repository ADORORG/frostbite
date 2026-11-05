import {
  domainEventEnvelopeSchema,
  type DomainEventEnvelope,
} from "@frostbite/events";
import { z } from "zod";

export const outboxRelayPolicySchema = z
  .object({
    batchSize: z.number().int().positive(),
    leaseDurationMs: z.number().int().positive(),
    maxAttempts: z.number().int().positive(),
    retryBaseMs: z.number().int().positive(),
    retryMaxMs: z.number().int().positive(),
  })
  .refine(({ retryBaseMs, retryMaxMs }) => retryMaxMs >= retryBaseMs, {
    message: "Retry maximum must be at least the retry base.",
    path: ["retryMaxMs"],
  });

export type OutboxRelayPolicy = z.infer<typeof outboxRelayPolicySchema>;

export const claimedOutboxEventSchema = z.object({
  attempts: z.number().int().positive(),
  event: domainEventEnvelopeSchema,
  leaseId: z.uuid(),
});

export type ClaimedOutboxEvent = z.infer<typeof claimedOutboxEventSchema>;

export interface OutboxDeliveryStore {
  claim(input: {
    readonly batchSize: number;
    readonly leaseExpiresAt: Date;
    readonly leaseId: string;
    readonly now: Date;
  }): Promise<readonly ClaimedOutboxEvent[]>;
  fail(input: {
    readonly eventId: string;
    readonly leaseId: string;
    readonly reason: string;
  }): Promise<void>;
  markDelivered(input: {
    readonly deliveredAt: Date;
    readonly eventId: string;
    readonly leaseId: string;
  }): Promise<void>;
  retry(input: {
    readonly availableAt: Date;
    readonly eventId: string;
    readonly leaseId: string;
    readonly reason: string;
  }): Promise<void>;
}

export interface WorkflowEventPublisher {
  publish(event: DomainEventEnvelope): Promise<void>;
}

export interface OutboxRelayDependencies {
  readonly clock: { now(): Date };
  readonly createLeaseId: () => string;
  readonly jitter: () => number;
  readonly publisher: WorkflowEventPublisher;
  readonly store: OutboxDeliveryStore;
}

export interface OutboxRelayResult {
  readonly claimed: number;
  readonly delivered: number;
  readonly failed: number;
  readonly retried: number;
}

export class TerminalWorkflowDeliveryError extends Error {}

function retryDelay(
  policy: OutboxRelayPolicy,
  attempts: number,
  jitter: number,
): number {
  const boundedJitter = Math.min(
    1,
    Math.max(0, z.number().finite().parse(jitter)),
  );
  const exponential = policy.retryBaseMs * 2 ** Math.max(0, attempts - 1);
  return Math.round(
    Math.min(policy.retryMaxMs, exponential) * (0.5 + boundedJitter / 2),
  );
}

export async function relayOutboxBatch(
  dependencies: OutboxRelayDependencies,
  policyInput: OutboxRelayPolicy,
): Promise<OutboxRelayResult> {
  const policy = outboxRelayPolicySchema.parse(policyInput);
  const claimedAt = dependencies.clock.now();
  const leaseId = dependencies.createLeaseId();
  const events = z.array(claimedOutboxEventSchema).parse(
    await dependencies.store.claim({
      batchSize: policy.batchSize,
      leaseExpiresAt: new Date(claimedAt.getTime() + policy.leaseDurationMs),
      leaseId,
      now: claimedAt,
    }),
  );
  let delivered = 0;
  let failed = 0;
  let retried = 0;

  for (const claimed of events) {
    try {
      await dependencies.publisher.publish(claimed.event);
    } catch (error) {
      const terminal = error instanceof TerminalWorkflowDeliveryError;
      const exhausted = claimed.attempts >= policy.maxAttempts;
      const reason = terminal
        ? "terminal workflow delivery failure"
        : "workflow provider unavailable";
      if (terminal || exhausted) {
        await dependencies.store.fail({
          eventId: claimed.event.eventId,
          leaseId: claimed.leaseId,
          reason,
        });
        failed += 1;
      } else {
        await dependencies.store.retry({
          availableAt: new Date(
            dependencies.clock.now().getTime() +
              retryDelay(policy, claimed.attempts, dependencies.jitter()),
          ),
          eventId: claimed.event.eventId,
          leaseId: claimed.leaseId,
          reason,
        });
        retried += 1;
      }
      continue;
    }

    await dependencies.store.markDelivered({
      deliveredAt: dependencies.clock.now(),
      eventId: claimed.event.eventId,
      leaseId: claimed.leaseId,
    });
    delivered += 1;
  }

  return { claimed: events.length, delivered, failed, retried };
}
