import { TerminalWorkflowDeliveryError } from "@frostbite/jobs";
import { describe, expect, it } from "vitest";

import { createInngestEventPublisher } from "../src/publisher.ts";
import { clientWith, devConfig, recordingFetch } from "./support/clients.ts";

const envelope = {
  causationId: null,
  correlationId: "018f22f2-9c1a-7b21-8c45-000000000005",
  eventId: "018f22f2-9c1a-7b21-8c45-000000000004",
  name: "uploads.assetprocessing.requested.v1",
  occurredAt: "2026-10-06T12:00:00.000Z",
  payload: { assetId: "asset-1", uploadIntentId: "intent-1" },
  schemaVersion: 1,
} as const;

describe("Inngest event publisher", () => {
  it("sends the envelope with its event id as the idempotency key", async () => {
    const { fetchDouble, requests } = recordingFetch(200);
    await createInngestEventPublisher(
      clientWith(devConfig, fetchDouble),
    ).publish(envelope);
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]?.url ?? "").pathname).toContain("/e/");
    expect(requests[0]?.body).toEqual([
      {
        data: {
          causationId: null,
          correlationId: envelope.correlationId,
          occurredAt: envelope.occurredAt,
          payload: envelope.payload,
          schemaVersion: 1,
        },
        id: envelope.eventId,
        name: envelope.name,
        ts: expect.any(Number),
      },
    ]);
  });

  it("carries the causation id when the event has one", async () => {
    const { fetchDouble, requests } = recordingFetch(200);
    const causationId = "018f22f2-9c1a-7b21-8c45-0000000000cc";
    await createInngestEventPublisher(
      clientWith(devConfig, fetchDouble),
    ).publish({ ...envelope, causationId });
    expect(requests[0]?.body).toMatchObject([{ data: { causationId } }]);
  });

  it.each([400, 413, 422])(
    "treats status %s as a terminal delivery failure",
    async (status) => {
      const { fetchDouble } = recordingFetch(status);
      await expect(
        createInngestEventPublisher(clientWith(devConfig, fetchDouble)).publish(
          envelope,
        ),
      ).rejects.toThrow(TerminalWorkflowDeliveryError);
    },
  );

  it.concurrent.each([401, 429, 503])(
    "leaves status %s retryable so the relay backs off",
    async (status) => {
      const { fetchDouble } = recordingFetch(status);
      const attempt = createInngestEventPublisher(
        clientWith(devConfig, fetchDouble),
      ).publish(envelope);
      await expect(attempt).rejects.toThrow(`${status}`);
      await expect(attempt).rejects.not.toBeInstanceOf(
        TerminalWorkflowDeliveryError,
      );
    },
  );

  it.concurrent("leaves a network failure retryable", async () => {
    const { fetchDouble } = recordingFetch(new TypeError("fetch failed"));
    const attempt = createInngestEventPublisher(
      clientWith(devConfig, fetchDouble),
    ).publish(envelope);
    await expect(attempt).rejects.toThrow("fetch failed");
    await expect(attempt).rejects.not.toBeInstanceOf(
      TerminalWorkflowDeliveryError,
    );
  });

  it("rethrows a failure that is not an Error without classifying it as terminal", async () => {
    const publisher = createInngestEventPublisher({
      send: async () => {
        throw "plain string";
      },
    });
    await expect(publisher.publish(envelope)).rejects.toBe("plain string");
  });
});
