import {
  domainEventEnvelopeSchema,
  type DomainEventEnvelope,
} from "@frostbite/events";
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";

import type {
  DatabaseClient,
  DatabaseTransaction,
} from "../connection/client.ts";
import { outboxEvents, type OutboxEvent } from "../schema/outbox.ts";

export class OutboxStateConflictError extends Error {
  constructor(eventId: string) {
    super(`Outbox event ${eventId} is not held by the supplied lease.`);
    this.name = "OutboxStateConflictError";
  }
}

export async function enqueueOutboxEvent(
  transaction: DatabaseTransaction,
  event: DomainEventEnvelope,
): Promise<void> {
  const validEvent = domainEventEnvelopeSchema.parse(event);
  await transaction.insert(outboxEvents).values({
    causationId: validEvent.causationId,
    correlationId: validEvent.correlationId,
    eventId: validEvent.eventId,
    eventName: validEvent.name,
    occurredAt: new Date(validEvent.occurredAt),
    payload: validEvent.payload,
    schemaVersion: validEvent.schemaVersion,
  });
}

export async function claimOutboxEvents(
  database: DatabaseClient,
  input: {
    readonly batchSize: number;
    readonly leaseExpiresAt: Date;
    readonly leaseId: string;
    readonly now: Date;
  },
): Promise<readonly OutboxEvent[]> {
  if (!Number.isSafeInteger(input.batchSize) || input.batchSize < 1) {
    throw new RangeError("Outbox batch size must be a positive safe integer.");
  }
  if (input.leaseExpiresAt <= input.now) {
    throw new RangeError("Outbox lease expiry must be later than now.");
  }

  return database.transaction(async (transaction) => {
    const candidates = await transaction
      .select({ eventId: outboxEvents.eventId })
      .from(outboxEvents)
      .where(
        and(
          lte(outboxEvents.availableAt, input.now),
          or(
            eq(outboxEvents.status, "pending"),
            and(
              eq(outboxEvents.status, "delivering"),
              lte(outboxEvents.leaseExpiresAt, input.now),
            ),
          ),
        ),
      )
      .orderBy(asc(outboxEvents.availableAt), asc(outboxEvents.eventId))
      .limit(input.batchSize)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) return [];
    return transaction
      .update(outboxEvents)
      .set({
        attempts: sql`${outboxEvents.attempts} + 1`,
        leaseExpiresAt: input.leaseExpiresAt,
        leaseId: input.leaseId,
        status: "delivering",
      })
      .where(
        inArray(
          outboxEvents.eventId,
          candidates.map(({ eventId }) => eventId),
        ),
      )
      .returning();
  });
}

async function updateLeasedEvent(
  database: DatabaseClient,
  input: { readonly eventId: string; readonly leaseId: string },
  values: Partial<OutboxEvent>,
): Promise<OutboxEvent> {
  const [updated] = await database
    .update(outboxEvents)
    .set(values)
    .where(
      and(
        eq(outboxEvents.eventId, input.eventId),
        eq(outboxEvents.leaseId, input.leaseId),
        eq(outboxEvents.status, "delivering"),
      ),
    )
    .returning();
  if (!updated) throw new OutboxStateConflictError(input.eventId);
  return updated;
}

export function markOutboxEventDelivered(
  database: DatabaseClient,
  input: {
    readonly deliveredAt: Date;
    readonly eventId: string;
    readonly leaseId: string;
  },
): Promise<OutboxEvent> {
  return updateLeasedEvent(database, input, {
    deliveredAt: input.deliveredAt,
    failureReason: null,
    leaseExpiresAt: null,
    leaseId: null,
    status: "delivered",
  });
}

export function retryOutboxEvent(
  database: DatabaseClient,
  input: {
    readonly availableAt: Date;
    readonly eventId: string;
    readonly failureReason: string;
    readonly leaseId: string;
  },
): Promise<OutboxEvent> {
  requireFailureReason(input.failureReason);
  return updateLeasedEvent(database, input, {
    availableAt: input.availableAt,
    failureReason: input.failureReason,
    leaseExpiresAt: null,
    leaseId: null,
    status: "pending",
  });
}

export function failOutboxEvent(
  database: DatabaseClient,
  input: {
    readonly eventId: string;
    readonly failureReason: string;
    readonly leaseId: string;
  },
): Promise<OutboxEvent> {
  requireFailureReason(input.failureReason);
  return updateLeasedEvent(database, input, {
    failureReason: input.failureReason,
    leaseExpiresAt: null,
    leaseId: null,
    status: "failed",
  });
}

function requireFailureReason(reason: string): void {
  if (reason.trim().length === 0) {
    throw new RangeError("Outbox failure reason must not be blank.");
  }
}
