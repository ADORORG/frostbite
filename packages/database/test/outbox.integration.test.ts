import type { DomainEventEnvelope } from "@frostbite/events";
import {
  relayOutboxBatch,
  TerminalWorkflowDeliveryError,
} from "@frostbite/jobs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  claimOutboxEvents,
  createOutboxDeliveryStore,
  createDatabaseClient,
  createDatabasePool,
  enqueueOutboxEvent,
  failOutboxEvent,
  markOutboxEventDelivered,
  outboxEvents,
  OutboxStateConflictError,
  parseDatabaseEnvironment,
  retryOutboxEvent,
  runMigrations,
} from "../src/index.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const now = new Date("2026-09-01T12:00:00.000Z");
const later = new Date("2026-09-01T12:01:00.000Z");

function event(
  eventId = "26ebfbc8-1410-4d63-8751-c66a2235f7a1",
): DomainEventEnvelope {
  return {
    causationId: null,
    correlationId: "8fb5845f-a0e8-4ea6-8f25-d3a6c46dd92f",
    eventId,
    name: "platform.fixture.created.v1",
    occurredAt: now.toISOString(),
    payload: { fixtureId: eventId },
    schemaVersion: 1,
  };
}

async function enqueue(value = event()) {
  await database.transaction((transaction) =>
    enqueueOutboxEvent(transaction, value),
  );
  const [available] = await database
    .update(outboxEvents)
    .set({ availableAt: now })
    .where(eq(outboxEvents.eventId, value.eventId))
    .returning();
  if (!available) throw new Error("Test outbox event was not returned.");
  return available;
}

async function claim(
  leaseId = "a8e4d617-963f-41f6-b5e8-6ebc70817890",
  claimNow = now,
) {
  return claimOutboxEvents(database, {
    batchSize: 10,
    leaseExpiresAt: new Date(claimNow.getTime() + 60_000),
    leaseId,
    now: claimNow,
  });
}

beforeAll(async () => {
  await runMigrations(environment);
});

beforeEach(async () => {
  await database.delete(outboxEvents);
});

afterAll(async () => {
  await pool.end();
});

describe("transactional outbox", () => {
  it("rolls the event back with its surrounding business transaction", async () => {
    await expect(
      database.transaction(async (transaction) => {
        await enqueueOutboxEvent(transaction, event());
        throw new Error("business mutation failed");
      }),
    ).rejects.toThrow("business mutation failed");

    expect(await database.select().from(outboxEvents)).toEqual([]);
  });

  it("preserves event identity and rejects duplicate enqueue", async () => {
    const inserted = await enqueue();
    expect(inserted).toMatchObject({
      attempts: 0,
      eventId: event().eventId,
      status: "pending",
    });
    await expect(enqueue()).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("claims available work once and increments attempts", async () => {
    await enqueue();
    const [claimed] = await claim();
    expect(claimed).toMatchObject({
      attempts: 1,
      leaseId: "a8e4d617-963f-41f6-b5e8-6ebc70817890",
      status: "delivering",
    });
    expect(await claim()).toEqual([]);
  });

  it("uses row locks to prevent concurrent duplicate claims", async () => {
    await enqueue();
    await enqueue(event("a2554dc1-188c-4c39-b38f-b6363547eb09"));
    const firstLease = "a8e4d617-963f-41f6-b5e8-6ebc70817890";
    const secondLease = "527198de-f44c-4cdc-849f-8ac8461d3bb4";
    const [first, second] = await Promise.all([
      claimOutboxEvents(database, {
        batchSize: 1,
        leaseExpiresAt: later,
        leaseId: firstLease,
        now,
      }),
      claimOutboxEvents(database, {
        batchSize: 1,
        leaseExpiresAt: later,
        leaseId: secondLease,
        now,
      }),
    ]);
    const claimedIds = [...first, ...second].map(({ eventId }) => eventId);
    expect(new Set(claimedIds).size).toBe(2);
  });

  it("recovers an expired lease without changing event identity", async () => {
    await enqueue();
    const [initial] = await claim();
    const recoveryTime = new Date("2026-09-01T12:02:00.000Z");
    const recoveryLease = "527198de-f44c-4cdc-849f-8ac8461d3bb4";
    const [recovered] = await claim(recoveryLease, recoveryTime);
    expect(recovered).toMatchObject({
      attempts: 2,
      eventId: initial?.eventId,
      leaseId: recoveryLease,
    });
    await expect(
      markOutboxEventDelivered(database, {
        deliveredAt: recoveryTime,
        eventId: recovered?.eventId ?? "",
        leaseId: initial?.leaseId ?? "",
      }),
    ).rejects.toBeInstanceOf(OutboxStateConflictError);
  });

  it("records acknowledgement and rejects a stale worker", async () => {
    await enqueue();
    const leaseId = "a8e4d617-963f-41f6-b5e8-6ebc70817890";
    const [claimed] = await claim(leaseId);
    const delivered = await markOutboxEventDelivered(database, {
      deliveredAt: later,
      eventId: claimed?.eventId ?? "",
      leaseId,
    });
    expect(delivered).toMatchObject({
      deliveredAt: later,
      leaseId: null,
      status: "delivered",
    });
    await expect(
      markOutboxEventDelivered(database, {
        deliveredAt: later,
        eventId: delivered.eventId,
        leaseId,
      }),
    ).rejects.toBeInstanceOf(OutboxStateConflictError);
  });

  it("adapts claimed rows to the provider-neutral relay contract", async () => {
    const terminal = event("a2554dc1-188c-4c39-b38f-b6363547eb09");
    const retryable = event("f2554dc1-188c-4c39-b38f-b6363547eb09");
    await enqueue();
    await enqueue(terminal);
    await enqueue(retryable);
    const published: DomainEventEnvelope[] = [];
    const result = await relayOutboxBatch(
      {
        clock: { now: () => now },
        createLeaseId: () => "a8e4d617-963f-41f6-b5e8-6ebc70817890",
        jitter: () => 0,
        publisher: {
          publish: async (value) => {
            published.push(value);
            if (value.eventId === terminal.eventId) {
              throw new TerminalWorkflowDeliveryError("invalid event");
            }
            if (value.eventId === retryable.eventId) throw new Error("outage");
          },
        },
        store: createOutboxDeliveryStore(database),
      },
      {
        batchSize: 3,
        leaseDurationMs: 60_000,
        maxAttempts: 3,
        retryBaseMs: 1_000,
        retryMaxMs: 10_000,
      },
    );
    expect(result).toEqual({ claimed: 3, delivered: 1, failed: 1, retried: 1 });
    expect(published).toHaveLength(3);
    const rows = await database.select().from(outboxEvents);
    expect(
      Object.fromEntries(rows.map((row) => [row.eventId, row.status])),
    ).toEqual({
      [event().eventId]: "delivered",
      [terminal.eventId]: "failed",
      [retryable.eventId]: "pending",
    });
  });

  it("schedules retry and later moves exhausted delivery to failed", async () => {
    await enqueue();
    const firstLease = "a8e4d617-963f-41f6-b5e8-6ebc70817890";
    const [claimed] = await claim(firstLease);
    const retryAt = new Date("2026-09-01T12:05:00.000Z");
    const pending = await retryOutboxEvent(database, {
      availableAt: retryAt,
      eventId: claimed?.eventId ?? "",
      failureReason: "workflow provider unavailable",
      leaseId: firstLease,
    });
    expect(pending).toMatchObject({ status: "pending", availableAt: retryAt });
    expect(await claim()).toEqual([]);

    const secondLease = "527198de-f44c-4cdc-849f-8ac8461d3bb4";
    const [retried] = await claim(secondLease, retryAt);
    const failed = await failOutboxEvent(database, {
      eventId: retried?.eventId ?? "",
      failureReason: "retry limit exhausted",
      leaseId: secondLease,
    });
    expect(failed).toMatchObject({
      attempts: 2,
      failureReason: "retry limit exhausted",
      status: "failed",
    });
    expect(
      await claim(secondLease, new Date("2026-09-01T13:00:00.000Z")),
    ).toEqual([]);
  });

  it("rejects invalid claim policy, unsafe events, and blank failures", async () => {
    await expect(
      claimOutboxEvents(database, {
        batchSize: 0,
        leaseExpiresAt: later,
        leaseId: "a8e4d617-963f-41f6-b5e8-6ebc70817890",
        now,
      }),
    ).rejects.toThrow("positive safe integer");
    await expect(
      claimOutboxEvents(database, {
        batchSize: 1,
        leaseExpiresAt: now,
        leaseId: "a8e4d617-963f-41f6-b5e8-6ebc70817890",
        now,
      }),
    ).rejects.toThrow("later than now");

    const unsafe = event();
    Reflect.deleteProperty(unsafe.payload, "fixtureId");
    Reflect.set(unsafe.payload, "secret", "value");
    await expect(enqueue(unsafe)).rejects.toThrow();
    await enqueue();
    const leaseId = "a8e4d617-963f-41f6-b5e8-6ebc70817890";
    const [claimed] = await claim(leaseId);
    expect(claimed).toBeDefined();
    expect(() =>
      failOutboxEvent(database, {
        eventId: event().eventId,
        failureReason: " ",
        leaseId,
      }),
    ).toThrow("must not be blank");

    const [row] = await database
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.eventId, event().eventId));
    expect(row?.status).toBe("delivering");
  });
});
