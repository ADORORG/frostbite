import { randomUUID } from "node:crypto";

import {
  createDatabaseFromEnvironment,
  parseDatabaseEnvironment,
} from "@ador/database/connection";
import { runMigrations } from "@ador/database";
import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import { chainOptionSchema } from "@ador/shared/chain";
import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import type { UuidV7 } from "@ador/shared/identifiers";
import {
  seedCreatorUser,
  seedDerivative,
  seedUploadedAsset,
} from "@ador/test-kit/creator-database";
import {
  storageRegistry,
  unusedStorage,
} from "@ador/test-kit/storage-registry";

import { createCollectionStudioEntrypoint } from "../../src/entrypoint.ts";
import { signet } from "./stubs.ts";

// The registered operations over the real database and the real uploads library, with only object
// storage faked (it signs a URL and nothing else): request validation, authentication, the
// repository rules, the error mapping, and the previews, end to end.
export const signedUrl = (key: string) =>
  `https://storage.example.test/${key}?signature=1`;
const storage: ObjectStoragePort = {
  ...unusedStorage,
  presignPrivateRead: async ({ key }) => ({
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    url: new URL(signedUrl(key)),
  }),
};

export const database = createDatabaseFromEnvironment(process.env);
const now = new Date("2026-10-09T12:00:00.000Z");
const entrypoint = createCollectionStudioEntrypoint(
  storageRegistry(() => storage),
  [
    chainOptionSchema.parse({
      chainId: signet,
      displayName: "Bitcoin signet",
      enabled: true,
      family: "bitcoin-alkanes",
      role: "public-beta",
    }),
  ],
);

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
  const response = await operation.execute(
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
  return response;
}

export const draft = (overrides: object = {}) => ({
  bannerAssetId: null,
  coverAssetId: null,
  description: "",
  name: "First light",
  plannedSupply: 2,
  provenance: "",
  targetChain: signet,
  ...overrides,
});
export const item = (imageAssetId: string) => ({
  attributes: [],
  description: "",
  imageAssetId,
  name: "Item",
});
export const errorOf = (body: object) =>
  httpErrorEnvelopeSchema.parse(body).error.code;
export const key = () => `integration-${randomUUID()}`;

export async function creatorWithImages() {
  const userId = await seedCreatorUser(database);
  const cover = await seedUploadedAsset(database, {
    now,
    purpose: "collection-artwork",
    userId,
  });
  const image = await seedUploadedAsset(database, {
    now,
    purpose: "collection-item-artwork",
    userId,
  });
  const coverKey = await seedDerivative(database, cover, "thumbnail");
  return { cover, coverKey, image, userId };
}
