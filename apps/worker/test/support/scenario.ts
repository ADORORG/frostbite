import { randomBytes } from "node:crypto";

import { createInngestProviderEntrypoint } from "@ador/provider-workflows-inngest/provider-entrypoint";
import { inngestWorkflowProvider } from "@ador/provider-workflows-inngest/registration";
import {
  createProviderRegistry,
  defineProvider,
} from "@ador/plugin-kit/providers";
import type { UploadCleanupResult } from "@ador/uploads";
import {
  freePort,
  startInngestRuntime,
  waitFor,
  type InngestRuntime,
} from "@ador/test-kit/inngest-runtime";
import { runtimeApi } from "@ador/test-kit/inngest-runtime-api";
import {
  serveFetchHandler,
  type ServedEndpoint,
} from "@ador/test-kit/serve-fetch-handler";

import { createWorkerRuntime, type WorkerRuntime } from "../../src/runtime.ts";
import { countingProcessor, memoryStorage } from "./fakes.ts";

// Everything a chain test needs, wired the way production wires it except for the two ports faked
// at their boundary: object storage and the media decoder.
export async function createScenario() {
  const hostPort = await freePort();
  const eventKey = randomBytes(16).toString("hex");
  const signingKey = randomBytes(32).toString("hex");
  const storage = memoryStorage();
  const decoder = countingProcessor();
  const environment = {
    APP_ENV: "test",
    INNGEST_APP_ID: "worker-chain",
    INNGEST_BASE_URL: `http://127.0.0.1:${hostPort}`,
    INNGEST_DEV: "false",
    INNGEST_EVENT_KEY: eventKey,
    INNGEST_SIGNING_KEY: signingKey,
  };
  const providers = createProviderRegistry([
    defineProvider({
      load: async () => ({
        capabilities: ["object-storage:s3-compatible"],
        createServices: () => ({
          "object-storage:s3-compatible": storage.storage,
        }),
        id: "test-object-storage",
        version: "1.0.0",
      }),
      manifest: {
        capabilities: ["object-storage:s3-compatible"],
        id: "test-object-storage",
        requiredDecisionGates: [],
        version: "1.0.0",
      },
    }),
    defineProvider({
      load: async () => ({
        capabilities: ["media-processing:image-derivatives"],
        createServices: () => ({
          "media-processing:image-derivatives": decoder.processor,
        }),
        id: "test-media-processing",
        version: "1.0.0",
      }),
      manifest: {
        capabilities: ["media-processing:image-derivatives"],
        id: "test-media-processing",
        requiredDecisionGates: [],
        version: "1.0.0",
      },
    }),
    defineProvider({
      load: async () => createInngestProviderEntrypoint(environment),
      manifest: inngestWorkflowProvider.manifest,
    }),
  ]);
  const worker: WorkerRuntime = createWorkerRuntime({
    environment: process.env,
    providers,
    rowSweepLimits: {
      batchSize: 10,
      contactCodeRetentionMs: 3_600_000,
      deliveredOutboxRetentionMs: 604_800_000,
    },
  });
  const served: ServedEndpoint = await serveFetchHandler(worker.handle);
  let inngest: InngestRuntime | undefined;
  async function runCleanup(
    results: UploadCleanupResult[],
    check: () => Promise<true | undefined>,
    timeoutMs: number,
  ): Promise<void> {
    const stop = new AbortController();
    const running = worker.runCleanup(stop.signal, {
      onError: () => undefined,
      onResult: (result) => void results.push(result),
    });
    try {
      await waitFor(check, timeoutMs, "the expected cleanup state");
    } finally {
      stop.abort();
      await running;
    }
  }
  return {
    decoder,
    // Runs the cleanup loop until `check` holds, then stops it.
    async runCleanupUntil(
      check: () => Promise<true | undefined>,
      timeoutMs = 30_000,
    ): Promise<readonly UploadCleanupResult[]> {
      const results: UploadCleanupResult[] = [];
      await runCleanup(results, check, timeoutMs);
      return results;
    },
    // Runs the cleanup loop until it has reported one pass that found work, then stops it.
    async runCleanupOnce(
      timeoutMs = 30_000,
    ): Promise<readonly UploadCleanupResult[]> {
      const results: UploadCleanupResult[] = [];
      await runCleanup(
        results,
        async () => (results.length > 0 ? true : undefined),
        timeoutMs,
      );
      return results;
    },
    async runRelayUntil<Value>(
      check: () => Promise<Value | undefined>,
      timeoutMs = 90_000,
    ): Promise<Value> {
      const stop = new AbortController();
      const errors: Error[] = [];
      const running = worker.runRelay(stop.signal, (error) =>
        errors.push(error),
      );
      try {
        return await waitFor(check, timeoutMs, "the expected state");
      } finally {
        stop.abort();
        await running;
      }
    },
    providers,
    served,
    storage,
    async startInngest(): Promise<InngestRuntime> {
      inngest = await startInngestRuntime({
        appPort: served.port,
        eventKey,
        hostPort,
        retryIntervalSeconds: 1,
        signingKey,
      });
      return inngest;
    },
    api: () => {
      if (inngest === undefined)
        throw new Error("The Inngest runtime has not been started.");
      return runtimeApi(inngest, signingKey);
    },
    async stop(): Promise<void> {
      await inngest?.stop();
      await served.stop();
      await worker.close();
    },
    worker,
  };
}
