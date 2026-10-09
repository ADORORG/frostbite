import {
  assetDerivatives,
  assets,
  createOutboxDeliveryStore,
  outboxEvents,
  runMigrations,
  parseDatabaseEnvironment,
} from "@ador/database";
import type { OutboxDeliveryStore } from "@ador/jobs";
import { defaultOutboxRelayPolicy } from "@ador/jobs/policy";
import { waitFor } from "@ador/test-kit/inngest-runtime";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createRelayPass } from "../src/relay.ts";
import { clearDatabase, database } from "./support/database.ts";
import { createScenario } from "./support/scenario.ts";
import { seedCompletedUpload, validPng } from "./support/seeds.ts";

beforeAll(async () => runMigrations(parseDatabaseEnvironment(process.env)));
beforeEach(clearDatabase);
afterAll(async () => clearDatabase());

const stateOf = async (assetId: string) =>
  (await database.select().from(assets).where(eq(assets.id, assetId)))[0];
const outboxOf = async (eventId: string) =>
  (
    await database
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.eventId, eventId))
  )[0];
const reached = (assetId: string, state: string) => async () =>
  (await stateOf(assetId))?.processingState === state ? true : undefined;

describe("the upload pipeline through the real worker, database, and Inngest runtime", () => {
  it("carries an upload completion from the outbox to a processed asset", async () => {
    const scenario = await createScenario();
    try {
      await scenario.startInngest();
      const bytes = validPng();
      const { assetId, eventId, objectKey } = await seedCompletedUpload({
        bytes,
      });
      scenario.storage.objects.set(objectKey, bytes);
      await scenario.runRelayUntil(reached(assetId, "processed"));
      expect(
        await database
          .select()
          .from(assetDerivatives)
          .where(eq(assetDerivatives.assetId, assetId)),
      ).toHaveLength(2);
      expect(scenario.storage.writes).toHaveLength(2);
      expect(scenario.decoder.calls()).toBe(1);
      expect(await stateOf(assetId)).toMatchObject({
        contentSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
        heightPixels: 5,
        widthPixels: 7,
      });
      expect(await outboxOf(eventId)).toMatchObject({ status: "delivered" });
      await scenario.api().waitForStatus(eventId, "Completed");
      expect(await scenario.api().runCount(eventId)).toBe(1);
    } finally {
      await scenario.stop();
    }
  }, 180_000);

  it("keeps the event and delivers it after the workflow provider returns from an outage", async () => {
    const scenario = await createScenario();
    try {
      const bytes = validPng();
      const { assetId, eventId, objectKey } = await seedCompletedUpload({
        bytes,
      });
      scenario.storage.objects.set(objectKey, bytes);
      const stop = new AbortController();
      const running = scenario.worker.runRelay(stop.signal, () => undefined);
      const retried = await waitFor(
        async () =>
          ((await outboxOf(eventId))?.attempts ?? 0) >= 1
            ? await outboxOf(eventId)
            : undefined,
        60_000,
        "a recorded delivery attempt",
      );
      stop.abort();
      await running;
      expect(retried).toMatchObject({ deliveredAt: null });
      expect(["pending", "delivering"]).toContain(retried?.status);
      expect((await stateOf(assetId))?.processingState).toBe(
        "pending-validation",
      );
      await scenario.startInngest();
      await scenario.runRelayUntil(reached(assetId, "processed"));
      expect(await outboxOf(eventId)).toMatchObject({ status: "delivered" });
      expect(await scenario.api().runCount(eventId)).toBe(1);
    } finally {
      await scenario.stop();
    }
  }, 240_000);

  it("starts one run when the delivery acknowledgement is lost and the event is published again", async () => {
    const scenario = await createScenario();
    try {
      await scenario.startInngest();
      const bytes = validPng();
      const { assetId, eventId, objectKey } = await seedCompletedUpload({
        bytes,
      });
      scenario.storage.objects.set(objectKey, bytes);
      const real = createOutboxDeliveryStore(database);
      let acknowledgementsLost = 0;
      const flaky: OutboxDeliveryStore = {
        ...real,
        markDelivered: async (input) => {
          if (acknowledgementsLost === 0) {
            acknowledgementsLost += 1;
            throw new Error("database unavailable");
          }
          return real.markDelivered(input);
        },
      };
      const pass = createRelayPass({
        clock: { now: () => new Date() },
        createLeaseId: () => crypto.randomUUID(),
        jitter: () => 0,
        policy: { ...defaultOutboxRelayPolicy, leaseDurationMs: 500 },
        publisher: () =>
          scenario.providers.resolve("workflow-orchestration:event-publisher"),
        store: flaky,
      });
      await expect(pass()).rejects.toThrow("database unavailable");
      expect((await outboxOf(eventId))?.deliveredAt).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(await pass()).toMatchObject({ delivered: 1 });
      await waitFor(
        reached(assetId, "processed"),
        90_000,
        "the processed asset",
      );
      await scenario.api().waitForStatus(eventId, "Completed");
      expect(await scenario.api().runCount(eventId)).toBe(1);
      expect(scenario.decoder.calls()).toBe(1);
      expect(await database.select().from(assetDerivatives)).toHaveLength(2);
    } finally {
      await scenario.stop();
    }
  }, 240_000);

  it("ends a rejected upload without processing it and without failing the run", async () => {
    const scenario = await createScenario();
    try {
      await scenario.startInngest();
      const hostile = Buffer.from(
        "<svg xmlns='http://www.w3.org/2000/svg'></svg>",
      );
      const { assetId, eventId, objectKey } = await seedCompletedUpload({
        bytes: hostile,
      });
      scenario.storage.objects.set(objectKey, hostile);
      await scenario.runRelayUntil(reached(assetId, "rejected"));
      expect(await stateOf(assetId)).toMatchObject({
        rejectionReason: "unsupported-format",
        contentSha256: null,
      });
      expect(await scenario.api().waitForStatus(eventId, "Completed")).toBe(
        "Completed",
      );
      expect(scenario.decoder.calls()).toBe(0);
      expect(scenario.storage.writes).toEqual([]);
      expect(await database.select().from(assetDerivatives)).toHaveLength(0);
    } finally {
      await scenario.stop();
    }
  }, 180_000);

  it("leaves the asset pending and retryable when storage keeps failing", async () => {
    const scenario = await createScenario();
    try {
      await scenario.startInngest();
      const bytes = validPng();
      const { assetId, eventId, objectKey } = await seedCompletedUpload({
        bytes,
      });
      scenario.storage.objects.set(objectKey, bytes);
      scenario.storage.failReads(true);
      const stop = new AbortController();
      const running = scenario.worker.runRelay(stop.signal, () => undefined);
      await waitFor(
        async () =>
          (await outboxOf(eventId))?.status === "delivered" ? true : undefined,
        60_000,
        "event delivery",
      );
      await new Promise((resolve) => setTimeout(resolve, 12_000));
      stop.abort();
      await running;
      expect(await stateOf(assetId)).toMatchObject({
        processingState: "pending-validation",
        contentSha256: null,
      });
      expect(await scenario.api().status(eventId)).toBe("Failed");
      scenario.storage.failReads(false);
    } finally {
      await scenario.stop();
    }
  }, 240_000);

  it("answers liveness and rejects unsigned workflow calls on the real HTTP server", async () => {
    const scenario = await createScenario();
    try {
      const health = await fetch(
        `http://127.0.0.1:${scenario.served.port}/health`,
      );
      expect([health.status, await health.json()]).toEqual([
        200,
        { status: "ok" },
      ]);
      for (const method of ["GET", "POST"]) {
        const response = await fetch(
          `http://127.0.0.1:${scenario.served.port}/api/inngest?fnId=worker-chain-asset-pipeline&stepId=step`,
          {
            ...(method === "POST" ? { body: "{}" } : {}),
            method,
          },
        );
        expect(response.status).toBe(401);
      }
      expect(
        (await fetch(`http://127.0.0.1:${scenario.served.port}/nope`)).status,
      ).toBe(404);
      const oversized = await fetch(
        `http://127.0.0.1:${scenario.served.port}/api/inngest`,
        { body: "x".repeat(1_048_577), method: "POST" },
      );
      expect(oversized.status).toBe(413);
    } finally {
      await scenario.stop();
    }
  }, 60_000);
});
