import { randomBytes, randomUUID } from "node:crypto";

import {
  assetDerivatives,
  assets,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  outboxEvents,
  parseDatabaseEnvironment,
  uploadIntents,
} from "@ador/database";
import { createInngestProviderEntrypoint } from "@ador/provider-workflows-inngest/provider-entrypoint";
import { inngestWorkflowProvider } from "@ador/provider-workflows-inngest/registration";
import { parseObjectKey } from "@ador/object-storage/contracts";
import {
  createProviderRegistry,
  defineProvider,
} from "@ador/plugin-kit/providers";
import { correlationIdSchema, idempotencyKeySchema } from "@ador/shared/http";
import { createUuidV7 } from "@ador/shared/identifiers";
import { createDrizzleUploadIntentRepository } from "@ador/uploads";
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
import {
  countingProcessor,
  memoryStorage,
  storageProviderId,
} from "./fakes.ts";
import { tinyPng } from "./png.ts";

// One reading of the real clock for every timestamp of the scenario. The database enforces ordering
// between them (cleanup after expiry), and the pipeline compares them with the real time, so a fixed
// calendar date would eventually fall out of order.
const now = new Date();

export const database = createDatabaseClient(
  createDatabasePool(parseDatabaseEnvironment(process.env)),
);

export async function clearDatabase(): Promise<void> {
  await database.delete(assetDerivatives);
  await database.delete(assets);
  await database.delete(outboxEvents);
  await database.delete(uploadIntents);
  await database.delete(authUsers);
}

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
  });
  const served: ServedEndpoint = await serveFetchHandler(worker.handle);
  let inngest: InngestRuntime | undefined;
  return {
    decoder,
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

// An upload that has just completed: a reserved intent turned into a pending asset plus its outbox
// event, in one transaction, exactly as the upload feature does it.
export async function seedCompletedUpload(options: { bytes: Buffer }) {
  const userId = createUuidV7();
  const intentId = createUuidV7();
  const assetId = createUuidV7();
  const eventId = createUuidV7();
  const objectKey = parseObjectKey(`drafts/${randomUUID()}`);
  await database
    .insert(authUsers)
    .values({ email: `${userId}@example.test`, id: userId, name: "Uploader" });
  const repository = createDrizzleUploadIntentRepository(database);
  await repository.reserve({
    activeLimit: 1,
    byteLength: options.bytes.length,
    cleanupEligibleAt: new Date(now.getTime() + 86_400_000),
    contentType: "image/png",
    createdAt: now,
    expiresAt: new Date(now.getTime() + 900_000),
    id: intentId,
    idempotencyKey: idempotencyKeySchema.parse("upload-request-0001"),
    objectKey,
    purpose: "collection-artwork",
    requestFingerprint: "a".repeat(64),
    retainUntil: new Date(now.getTime() + 2_592_000_000),
    storageProviderId,
    userId,
  });
  await repository.complete({
    assetId,
    completedAt: new Date(),
    event: {
      causationId: null,
      correlationId: correlationIdSchema.parse(createUuidV7()),
      eventId,
      name: "uploads.assetprocessing.requested.v1",
      occurredAt: new Date().toISOString(),
      payload: { assetId, uploadIntentId: intentId },
      schemaVersion: 1,
    },
    intentId,
    object: {
      contentLength: options.bytes.length,
      contentType: "image/png",
      entityTag: "etag",
      lastModified: now,
      providerId: storageProviderId,
    },
    userId,
  });
  return { assetId, eventId, objectKey };
}

export const validPng = () => tinyPng(7, 5);
