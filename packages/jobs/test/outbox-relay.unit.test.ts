import type { DomainEventEnvelope } from "@frostbite/events";
import { describe, expect, it, vi } from "vitest";

import {
  relayOutboxBatch,
  TerminalWorkflowDeliveryError,
  type ClaimedOutboxEvent,
  type OutboxDeliveryStore,
} from "../src/outbox-relay.js";

const now = new Date("2026-09-06T12:00:00.000Z");
const event: DomainEventEnvelope = {
  causationId: null,
  correlationId: "8fb5845f-a0e8-4ea6-8f25-d3a6c46dd92f",
  eventId: "26ebfbc8-1410-4d63-8751-c66a2235f7a1",
  name: "platform.fixture.created.v1",
  occurredAt: now.toISOString(),
  payload: { fixtureId: "fixture-1" },
  schemaVersion: 1,
};
const policy = {
  batchSize: 10,
  leaseDurationMs: 60_000,
  maxAttempts: 3,
  retryBaseMs: 1_000,
  retryMaxMs: 10_000,
};

function claimed(attempts = 1): ClaimedOutboxEvent {
  return {
    attempts,
    event,
    leaseId: "a8e4d617-963f-41f6-b5e8-6ebc70817890",
  };
}

function setup(values: readonly ClaimedOutboxEvent[]) {
  const store: OutboxDeliveryStore = {
    claim: vi.fn(async () => values),
    fail: vi.fn(async () => undefined),
    markDelivered: vi.fn(async () => undefined),
    retry: vi.fn(async () => undefined),
  };
  const publish = vi.fn(async () => undefined);
  const dependencies = {
    clock: { now: () => now },
    createLeaseId: () => "a8e4d617-963f-41f6-b5e8-6ebc70817890",
    jitter: () => 1,
    publisher: { publish },
    store,
  };
  return { dependencies, publish, store };
}

describe("outbox relay", () => {
  it("claims with a lease and acknowledges successful publication", async () => {
    const { dependencies, publish, store } = setup([claimed()]);
    await expect(relayOutboxBatch(dependencies, policy)).resolves.toEqual({
      claimed: 1,
      delivered: 1,
      failed: 0,
      retried: 0,
    });
    expect(store.claim).toHaveBeenCalledWith({
      batchSize: 10,
      leaseExpiresAt: new Date("2026-09-06T12:01:00.000Z"),
      leaseId: "a8e4d617-963f-41f6-b5e8-6ebc70817890",
      now,
    });
    expect(publish).toHaveBeenCalledWith(event);
    expect(store.markDelivered).toHaveBeenCalledWith({
      deliveredAt: now,
      eventId: event.eventId,
      leaseId: claimed().leaseId,
    });
  });

  it("schedules a bounded jittered retry without leaking provider errors", async () => {
    const { dependencies, publish, store } = setup([claimed(2)]);
    publish.mockRejectedValue(new Error("secret provider response"));
    await expect(relayOutboxBatch(dependencies, policy)).resolves.toMatchObject(
      { retried: 1 },
    );
    expect(store.retry).toHaveBeenCalledWith({
      availableAt: new Date("2026-09-06T12:00:02.000Z"),
      eventId: event.eventId,
      leaseId: claimed().leaseId,
      reason: "workflow provider unavailable",
    });
  });

  it("propagates acknowledgement failure for lease recovery", async () => {
    const { dependencies, store } = setup([claimed()]);
    vi.mocked(store.markDelivered).mockRejectedValue(
      new Error("database unavailable"),
    );
    await expect(relayOutboxBatch(dependencies, policy)).rejects.toThrow(
      "database unavailable",
    );
    expect(store.retry).not.toHaveBeenCalled();
    expect(store.fail).not.toHaveBeenCalled();
  });

  it.each([
    [new TerminalWorkflowDeliveryError("invalid event"), 1],
    [new Error("outage"), 3],
  ])("persists terminal or exhausted failures", async (failure, attempts) => {
    const { dependencies, publish, store } = setup([claimed(attempts)]);
    publish.mockRejectedValue(failure);
    await expect(relayOutboxBatch(dependencies, policy)).resolves.toMatchObject(
      { failed: 1 },
    );
    expect(store.fail).toHaveBeenCalledOnce();
    expect(store.retry).not.toHaveBeenCalled();
  });

  it("rejects contradictory retry policy before claiming", async () => {
    const { dependencies, store } = setup([]);
    await expect(
      relayOutboxBatch(dependencies, { ...policy, retryMaxMs: 999 }),
    ).rejects.toThrow("Retry maximum");
    expect(store.claim).not.toHaveBeenCalled();
  });

  it("rejects invalid claimed state before publication", async () => {
    const { dependencies, publish } = setup([{ ...claimed(), attempts: 0 }]);
    await expect(relayOutboxBatch(dependencies, policy)).rejects.toThrow();
    expect(publish).not.toHaveBeenCalled();
  });

  it("rejects a non-finite jitter result before persisting a retry", async () => {
    const { dependencies, publish, store } = setup([claimed()]);
    publish.mockRejectedValue(new Error("outage"));
    await expect(
      relayOutboxBatch({ ...dependencies, jitter: () => Number.NaN }, policy),
    ).rejects.toThrow();
    expect(store.retry).not.toHaveBeenCalled();
  });
});
