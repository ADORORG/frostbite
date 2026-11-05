import type { DomainEventEnvelope } from "@frostbite/events";
import type {
  ClaimedOutboxEvent,
  OutboxDeliveryStore,
  OutboxRelayPolicy,
  WorkflowEventPublisher,
} from "@frostbite/jobs";
import { describe, expect, it } from "vitest";

import { createRelayPass } from "../src/relay.ts";

const policy: OutboxRelayPolicy = {
  batchSize: 5,
  leaseDurationMs: 60_000,
  maxAttempts: 3,
  retryBaseMs: 1_000,
  retryMaxMs: 10_000,
};
const now = new Date("2026-10-06T12:00:00.000Z");
const leaseId = "018f22f2-9c1a-7b21-8c45-0000000000aa";
const otherLease = "018f22f2-9c1a-7b21-8c45-0000000000bb";
const event: DomainEventEnvelope = {
  causationId: null,
  correlationId: "018f22f2-9c1a-7b21-8c45-000000000005",
  eventId: "018f22f2-9c1a-7b21-8c45-000000000004",
  name: "uploads.assetprocessing.requested.v1",
  occurredAt: now.toISOString(),
  payload: { assetId: "asset-1", uploadIntentId: "intent-1" },
  schemaVersion: 1,
};

function store(claimed: readonly ClaimedOutboxEvent[]) {
  const log: string[] = [];
  const fake: OutboxDeliveryStore = {
    claim: async (input) => {
      log.push(
        `claim:${input.batchSize}:${input.leaseId}:${input.leaseExpiresAt.toISOString()}`,
      );
      return claimed;
    },
    fail: async ({ eventId }) => void log.push(`fail:${eventId}`),
    markDelivered: async ({ eventId, leaseId }) =>
      void log.push(`delivered:${eventId}:${leaseId}`),
    retry: async ({ eventId }) => void log.push(`retry:${eventId}`),
  };
  return { log, store: fake };
}

describe("outbox relay pass", () => {
  it("claims with the configured batch and lease, publishes by event id, and records delivery", async () => {
    const { log, store: fake } = store([{ attempts: 1, event, leaseId }]);
    const published: string[] = [];
    const publisher: WorkflowEventPublisher = {
      publish: async (envelope) => void published.push(envelope.eventId),
    };
    const pass = createRelayPass({
      clock: { now: () => now },
      createLeaseId: () => otherLease,
      jitter: () => 0.5,
      policy,
      publisher: async () => publisher,
      store: fake,
    });
    expect(await pass()).toEqual({
      claimed: 1,
      delivered: 1,
      failed: 0,
      retried: 0,
    });
    expect(published).toEqual([event.eventId]);
    expect(log).toEqual([
      `claim:5:${otherLease}:${new Date(now.getTime() + 60_000).toISOString()}`,
      `delivered:${event.eventId}:${leaseId}`,
    ]);
  });

  it("schedules a retry when the provider fails, using the injected clock and jitter", async () => {
    const retries: Date[] = [];
    const { store: fake } = store([{ attempts: 1, event, leaseId }]);
    fake.retry = async ({ availableAt }) => void retries.push(availableAt);
    const pass = createRelayPass({
      clock: { now: () => now },
      createLeaseId: () => otherLease,
      jitter: () => 1,
      policy,
      publisher: async () => ({
        publish: async () => {
          throw new Error("outage");
        },
      }),
      store: fake,
    });
    expect(await pass()).toMatchObject({ retried: 1 });
    expect(retries).toEqual([new Date(now.getTime() + 1_000)]);
  });

  it("resolves the publisher on every pass, so a provider that was down can recover", async () => {
    let calls = 0;
    const pass = createRelayPass({
      clock: { now: () => now },
      createLeaseId: () => otherLease,
      jitter: () => 0,
      policy,
      publisher: async () => {
        calls += 1;
        if (calls === 1) throw new Error("not configured yet");
        return { publish: async () => undefined };
      },
      store: store([]).store,
    });
    await expect(pass()).rejects.toThrow("not configured yet");
    expect(await pass()).toEqual({
      claimed: 0,
      delivered: 0,
      failed: 0,
      retried: 0,
    });
  });
});
