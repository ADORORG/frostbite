import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { createOutboxDeliveryStore } from "@ador/database";
import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@ador/database/connection";
import { createAssetPipelineResolver } from "@ador/feature-uploads/pipeline";
import {
  defaultOutboxRelayPolicy,
  defaultRelayLoopPolicy,
  resolveWorkflowPolicy,
} from "@ador/jobs/policy";
import { runOutboxRelayLoop } from "@ador/jobs/relay-loop";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";

import { createSignedEndpointResolver } from "./endpoint.ts";
import { createRelayPass } from "./relay.ts";
import { createWorkerRoutes } from "./routes.ts";

export interface WorkerRuntime {
  close(): Promise<void>;
  readonly handle: (request: Request) => Promise<Response>;
  // Runs the outbox relay until the signal aborts.
  runRelay(signal: AbortSignal, onError: (error: Error) => void): Promise<void>;
}

// Composes the worker from the provider registry and validated environment: the signed workflow
// endpoint with its activities, and the outbox relay. Provider services resolve lazily, so a missing
// provider setting surfaces on first use instead of at import.
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
  return {
    close: () => pool.end(),
    handle: createWorkerRoutes({ endpoint }),
    runRelay: (signal, onError) =>
      runOutboxRelayLoop(
        {
          onError,
          relay,
          signal,
          sleep: (delayMs, abort) =>
            delay(delayMs, undefined, { signal: abort }).catch(() => undefined),
        },
        defaultRelayLoopPolicy,
      ),
  };
}
