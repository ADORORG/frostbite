import { randomUUID } from "node:crypto";

import { createDrizzleSubmissionRepository } from "@ador/collections";
import { runMigrations } from "@ador/database";
import {
  createDatabaseFromEnvironment,
  parseDatabaseEnvironment,
} from "@ador/database/connection";
import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import { requestFingerprint } from "@ador/shared/http";
import {
  createUuidV7,
  uuidV7Schema,
  type UuidV7,
} from "@ador/shared/identifiers";
import {
  seedReadyCollection,
  seededChain,
} from "@ador/test-kit/collection-database";
import {
  seedDerivative,
  seedPlatformUser,
} from "@ador/test-kit/creator-database";
import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import {
  storageRegistry,
  unusedStorage,
} from "@ador/test-kit/storage-registry";
import { authorizationPolicy } from "@repo/config/authorization";

import { createCollectionReviewEntrypoint } from "../../src/entrypoint.tsx";

// The registered review operations over the real database and the real authorization policy.
export const database = createDatabaseFromEnvironment(process.env);
export const signedUrl = (key: string) =>
  `https://storage.example.test/${key}?signature=1`;
// Only signing is faked: it returns a URL and nothing else.
const storage: ObjectStoragePort = {
  ...unusedStorage,
  presignPrivateRead: async ({ key }) => ({
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    url: new URL(signedUrl(key)),
  }),
};
const entrypoint = createCollectionReviewEntrypoint(
  authorizationPolicy,
  storageRegistry(() => storage),
);
const submissions = createDrizzleSubmissionRepository(database);

export const migrate = () =>
  runMigrations(parseDatabaseEnvironment(process.env));

export async function call(
  route: { readonly method: string; readonly operationId: string },
  options: {
    readonly actor: UuidV7 | null;
    readonly body?: object;
    readonly key?: string;
  },
) {
  const operation = entrypoint.operations?.find(
    ({ route: candidate }) => candidate.operationId === route.operationId,
  );
  if (operation === undefined)
    throw new Error(`no operation ${route.operationId}`);
  return operation.execute(
    {
      actorSession: null,
      actorUserId: options.actor,
      headers:
        options.key === undefined ? {} : { "idempotency-key": options.key },
      method: route.method,
      rawInput: options.body ?? {},
    },
    { createCorrelationId: randomUUID },
  );
}

export const key = () => `integration-${randomUUID()}`;
export const errorOf = (body: object) =>
  httpErrorEnvelopeSchema.parse(body).error.code;
export const reviewer = () => seedPlatformUser(database);

// A creator's collection, frozen as a submission the way the creator-facing operation would.
export async function submittedCollection() {
  const now = new Date();
  const seed = await seedReadyCollection(database, { now });
  const result = await submissions.submit({
    actorUserId: seed.ownerUserId,
    allowedChains: [seededChain],
    changedAt: now,
    collectionId: seed.collectionId,
    correlationId: uuidV7Schema.parse(createUuidV7()),
    eventId: uuidV7Schema.parse(createUuidV7()),
    expectedRevision: seed.revision,
    idempotencyKey: key(),
    policyVersion: "collection-review-beta-v1",
    requestFingerprint: requestFingerprint({ seed: seed.collectionId }),
    submissionId: uuidV7Schema.parse(createUuidV7()),
  });
  if (result.kind !== "submitted") throw new Error(`got ${result.kind}`);
  const coverKey = await seedDerivative(database, seed.cover, "thumbnail");
  return { ...seed, coverKey, submissionId: result.submission.id };
}
