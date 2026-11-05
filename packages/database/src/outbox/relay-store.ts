import { domainEventEnvelopeSchema } from "@frostbite/events";
import type { ClaimedOutboxEvent, OutboxDeliveryStore } from "@frostbite/jobs";

import type { DatabaseClient } from "../connection/client.ts";
import type { OutboxEvent } from "../schema/outbox.ts";
import {
  claimOutboxEvents,
  failOutboxEvent,
  markOutboxEventDelivered,
  retryOutboxEvent,
} from "./repository.ts";

export function toClaimedEvent(row: OutboxEvent): ClaimedOutboxEvent {
  const event = domainEventEnvelopeSchema.parse({
    causationId: row.causationId,
    correlationId: row.correlationId,
    eventId: row.eventId,
    name: row.eventName,
    occurredAt: row.occurredAt.toISOString(),
    payload: row.payload,
    schemaVersion: row.schemaVersion,
  });
  if (!row.leaseId) throw new Error("Claimed outbox event has no lease ID.");
  return { attempts: row.attempts, event, leaseId: row.leaseId };
}

export function createOutboxDeliveryStore(
  database: DatabaseClient,
): OutboxDeliveryStore {
  return {
    claim: async (input) =>
      (await claimOutboxEvents(database, input)).map(toClaimedEvent),
    fail: async ({ eventId, leaseId, reason }) => {
      await failOutboxEvent(database, {
        eventId,
        failureReason: reason,
        leaseId,
      });
    },
    markDelivered: async ({ deliveredAt, eventId, leaseId }) => {
      await markOutboxEventDelivered(database, {
        deliveredAt,
        eventId,
        leaseId,
      });
    },
    retry: async ({ availableAt, eventId, leaseId, reason }) => {
      await retryOutboxEvent(database, {
        availableAt,
        eventId,
        failureReason: reason,
        leaseId,
      });
    },
  };
}
