import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { createOutboxDeliveryStore } from "@ador/database";
import {
  createDatabaseClient,
  createDatabasePool,
  databaseReadinessProbe,
  parseDatabaseEnvironment,
} from "@ador/database/connection";
import {
  createUploadCleanupResolver,
  type UploadCleanupResult,
} from "@ador/feature-uploads/cleanup";
import { createAssetPipelineResolver } from "@ador/feature-uploads/pipeline";
import { runReadiness } from "@ador/http/readiness";
import { runDrainLoop } from "@ador/jobs/drain-loop";
import {
  defaultMaintenanceLoopPolicy,
  defaultOutboxRelayPolicy,
  defaultRelayLoopPolicy,
  resolveWorkflowPolicy,
} from "@ador/jobs/policy";
import { runOutboxRelayLoop } from "@ador/jobs/relay-loop";
import { storageReadinessProbe } from "@ador/object-storage/readiness";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";

import { createCleanupPass } from "./cleanup.ts";
import { createSignedEndpointResolver } from "./endpoint.ts";
import { createRelayPass } from "./relay.ts";
import { createWorkerRoutes } from "./routes.ts";

export interface CleanupHandlers {
  onError(error: Error): void;
  // Called for every pass that found abandoned uploads, with what became of them.
  onResult(result: UploadCleanupResult): void;
}

export interface WorkerRuntime {
  close(): Promise<void>;
  readonly handle: (request: Request) => Promise<Response>;
  // Removes abandoned uploads' private objects periodically until the signal aborts.
  runCleanup(signal: AbortSignal, handlers: CleanupHandlers): Promise<void>;
  // Runs the outbox relay until the signal aborts.
  runRelay(signal: AbortSignal, onError: (error: Error) => void): Promise<void>;
}

// Resolves after `delayMs`, or early (without error) when the signal aborts.
const sleep = (delayMs: number, abort: AbortSignal): Promise<void> =>
  delay(delayMs, undefined, { signal: abort }).catch(() => undefined);

// Composes the worker from the provider registry and validated environment: the signed workflow
// endpoint with its activities, the outbox relay, and the abandoned-upload cleanup. Provider services
// resolve lazily, so a missing provider setting surfaces on first use instead of at import.
export function createWorkerRuntime(dependencies: {
  readonly environment: NodeJS.ProcessEnv;
  readonly providers: ProviderRegistry;
}): WorkerRuntime {
  const { environment, providers } = dependencies;
  const pool = createDatabasePool(parseDatabaseEnvironment(environment));
  const database = createDatabaseClient(pool);
  const endpoint = createSignedEndpointResolver({
    activities: createAssetPipelineResolver(providers, { database }),
    factory: () => providers.resolve("workflow-orchestration:signed-endpoint"),
    policy: resolveWorkflowPolicy(),
  });
  const relay = createRelayPass({
    clock: { now: () => new Date() },
    createLeaseId: randomUUID,
    jitter: Math.random,
    policy: defaultOutboxRelayPolicy,
    publisher: () =>
      providers.resolve("workflow-orchestration:event-publisher"),
    store: createOutboxDeliveryStore(database),
  });
  const cleanup = createUploadCleanupResolver(providers, { database });
  return {
    close: () => pool.end(),
    handle: createWorkerRoutes({
      endpoint,
      readiness: () =>
        runReadiness(
          [
            databaseReadinessProbe(database),
            {
              check: async (signal) =>
                storageReadinessProbe(
                  await providers.resolve("object-storage:s3-compatible"),
                ).check(signal),
              name: "object-storage",
            },
          ],
          {
            onFailure: (name, error) =>
              console.error(
                `readiness: ${name} is not ready: ${error.message}`,
              ),
          },
        ),
    }),
    runCleanup: (signal, handlers) =>
      runDrainLoop(
        {
          failureMessage: "Cleanup failed.",
          onError: handlers.onError,
          pass: createCleanupPass({
            onResult: handlers.onResult,
            sweep: async () => (await cleanup()).sweep,
          }),
          signal,
          sleep,
        },
        defaultMaintenanceLoopPolicy,
      ),
    runRelay: (signal, onError) =>
      runOutboxRelayLoop(
        { onError, relay, signal, sleep },
        defaultRelayLoopPolicy,
      ),
  };
}
