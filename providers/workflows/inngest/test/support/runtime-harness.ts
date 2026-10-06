import { randomUUID } from "node:crypto";

import type {
  AssetProcessingStatus,
  AssetValidationStatus,
} from "@ador/jobs/activities";
import {
  freePort,
  startInngestRuntime,
  type InngestRuntime,
} from "@ador/test-kit/inngest-runtime";
import { runtimeApi } from "@ador/test-kit/inngest-runtime-api";
import {
  serveFetchHandler,
  type ServedEndpoint,
} from "@ador/test-kit/serve-fetch-handler";
import { afterAll, beforeAll } from "vitest";

import { createInngestClient } from "../../src/client.ts";
import type { InngestConfig } from "../../src/config.ts";
import { createInngestEndpointFactory } from "../../src/create-endpoint.ts";
import { createInngestEventPublisher } from "../../src/publisher.ts";
import { silentLogger } from "./clients.ts";

export const retries = 2;
export const maxConcurrentMediaRuns = 2;

export interface Behaviour {
  process(assetId: string): Promise<AssetProcessingStatus>;
  validate(assetId: string): Promise<AssetValidationStatus>;
}
export const happy: Behaviour = {
  process: async () => "processed",
  validate: async () => "validated",
};

// One real, signed Inngest server and an endpoint whose activities delegate to a per-test behaviour,
// recording every call. Registers its own setup and teardown with the calling test file.
export function useRealRuntime() {
  const keys = {
    eventKey: randomUUID().replaceAll("-", ""),
    signingKey: "ab".repeat(32),
  };
  let behaviour: Behaviour = happy;
  const calls: string[] = [];
  let runtime: InngestRuntime;
  let served: ServedEndpoint;
  let config: InngestConfig;
  let api: ReturnType<typeof runtimeApi>;

  beforeAll(async () => {
    const hostPort = await freePort();
    config = {
      appId: "runtime-test",
      baseUrl: `http://127.0.0.1:${hostPort}`,
      dev: false,
      ...keys,
    };
    const endpoint = createInngestEndpointFactory(
      createInngestClient(config, { logger: silentLogger }),
    ).createEndpoint({
      activities: {
        processAsset: async ({ assetId }) => (
          calls.push(`process:${assetId}`),
          behaviour.process(assetId)
        ),
        validateAsset: async ({ assetId }) => (
          calls.push(`validate:${assetId}`),
          behaviour.validate(assetId)
        ),
      },
      policy: { maxConcurrentMediaRuns, retries },
    });
    served = await serveFetchHandler(endpoint);
    runtime = await startInngestRuntime({
      appPort: served.port,
      eventKey: keys.eventKey,
      hostPort,
      retryIntervalSeconds: 1,
      signingKey: keys.signingKey,
    });
    api = runtimeApi(runtime, keys.signingKey);
  }, 120_000);

  afterAll(async () => {
    await runtime?.stop();
    await served?.stop();
  });

  const callsFor = (assetId: string) =>
    calls
      .filter((call) => call.endsWith(`:${assetId}`))
      .map((call) => call.split(":")[0]);

  return {
    api: () => api,
    behave: (next: Behaviour) => void (behaviour = next),
    callCount: () => calls.length,
    callsFor,
    config: () => config,
    envelope: (assetId: string, eventId = randomUUID()) =>
      ({
        causationId: null,
        correlationId: randomUUID(),
        eventId,
        name: "uploads.assetprocessing.requested.v1",
        occurredAt: "2026-10-06T12:00:00.000Z",
        payload: { assetId, uploadIntentId: `intent-${assetId}` },
        schemaVersion: 1,
      }) as const,
    publisher: () =>
      createInngestEventPublisher(
        createInngestClient(config, { logger: silentLogger }),
      ),
    // The runtime's REST status reads `Failed` from the first failed attempt while retries are still
    // pending, so failure scenarios are judged by the observed call sequence once it has gone quiet
    // for longer than any retry interval.
    async quiet(assetId: string, quietMs = 4_000): Promise<void> {
      let lastCount = -1;
      let lastChange = Date.now();
      while (Date.now() - lastChange < quietMs) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const count = callsFor(assetId).length;
        if (count !== lastCount) {
          lastCount = count;
          lastChange = Date.now();
        }
      }
    },
    served: () => served,
  };
}
