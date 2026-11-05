import {
  relayOutboxBatch,
  type OutboxDeliveryStore,
  type OutboxRelayPolicy,
  type OutboxRelayResult,
  type WorkflowEventPublisher,
} from "@frostbite/jobs";

export interface RelayDependencies {
  readonly clock: { now(): Date };
  readonly createLeaseId: () => string;
  readonly jitter: () => number;
  readonly policy: OutboxRelayPolicy;
  // Resolved on every pass, so a provider that is unavailable now can recover later.
  readonly publisher: () => Promise<WorkflowEventPublisher>;
  readonly store: OutboxDeliveryStore;
}

// One bounded relay pass: claim leased outbox rows, publish them with their stable event ids, and
// record delivery, retry, or terminal failure. Business completion is never inferred from delivery.
export function createRelayPass(
  dependencies: RelayDependencies,
): () => Promise<OutboxRelayResult> {
  return async () =>
    relayOutboxBatch(
      {
        clock: dependencies.clock,
        createLeaseId: dependencies.createLeaseId,
        jitter: dependencies.jitter,
        publisher: await dependencies.publisher(),
        store: dependencies.store,
      },
      dependencies.policy,
    );
}
