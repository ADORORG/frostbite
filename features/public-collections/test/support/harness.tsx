import { randomUUID } from "node:crypto";

import { createDrizzleSubmissionRepository } from "@frostbite/collections";
import { runMigrations } from "@frostbite/database";
import {
  createDatabaseFromEnvironment,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import type { ObjectStoragePort } from "@frostbite/object-storage/contracts";
import { createProviderRegistry } from "@frostbite/plugin-kit/providers";
import { requestFingerprint } from "@frostbite/shared/http";
import { createUuidV7, uuidV7Schema } from "@frostbite/shared/identifiers";
import {
  seedReadyCollection,
  seededChain,
} from "@frostbite/test-kit/collection-database";
import {
  seedDerivative,
  seedPlatformUser,
  setCreatorApplicationState,
} from "@frostbite/test-kit/creator-database";
import {
  storageRegistry,
  unusedStorage,
} from "@frostbite/test-kit/storage-registry";
import { ScenesProvider } from "@frostbite/scenes/react";
import { renderToStaticMarkup } from "react-dom/server";

import { createPublicCollectionsEntrypoint } from "../../src/entrypoint.tsx";
import { chains } from "./fixtures.ts";

export const database = createDatabaseFromEnvironment(process.env);
export const migrate = () =>
  runMigrations(parseDatabaseEnvironment(process.env));
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

const submissions = createDrizzleSubmissionRepository(database);
const now = () => new Date();
const newId = () => uuidV7Schema.parse(createUuidV7());

function mutation(actorUserId: ReturnType<typeof newId>, key: string) {
  return {
    actorUserId,
    changedAt: now(),
    correlationId: newId(),
    eventId: newId(),
    idempotencyKey: `${key}-${randomUUID()}`,
    policyVersion: "collection-review-beta-v1",
    requestFingerprint: requestFingerprint({ key, random: randomUUID() }),
  };
}

// A creator's collection taken through review as far as `through`: submitted, in review, or approved.
export async function collectionThrough(
  through: "approved" | "submitted" | "under-review",
) {
  const seed = await seedReadyCollection(database, { now: now() });
  const coverKey = await seedDerivative(database, seed.cover, "thumbnail");
  const result = await submissions.submit({
    ...mutation(seed.ownerUserId, "submit"),
    allowedChains: [seededChain],
    collectionId: seed.collectionId,
    expectedRevision: seed.revision,
    submissionId: newId(),
  });
  if (result.kind !== "submitted") throw new Error(`got ${result.kind}`);
  const reviewer = await seedPlatformUser(database);
  const decide = (action: "approve" | "start-review", privateNotes = "") =>
    submissions.decide({
      ...mutation(reviewer, action),
      action,
      allowedReviewerRoles: ["reviewer"],
      creatorFeedback: "",
      privateNotes,
      reasonCode: "secret-reason-code",
      submissionId: result.submission.id,
    });
  if (through !== "submitted")
    await decide("start-review", "private reviewer note");
  if (through === "approved") await decide("approve", "private approval note");
  return {
    ...seed,
    coverKey,
    payloadHash: result.submission.payloadHash,
    submissionId: result.submission.id,
  };
}

export const suspendCreator = (userId: string) =>
  setCreatorApplicationState(database, userId, "suspended");

export type Pages = {
  readonly render: (page: "detail" | "index", slug?: string) => Promise<string>;
};

// The registered pages, rendered to the markup a visitor receives.
export async function pagesFor(
  providers = storageRegistry(() => storage),
): Promise<Pages> {
  const entrypoint = createPublicCollectionsEntrypoint(providers, chains);
  const [index, detail] = entrypoint.pages ?? [];
  return {
    async render(page, slug) {
      const target = page === "index" ? index : detail;
      const element = await target?.render({
        actorUserId: null,
        navigation: [],
        params: slug === undefined ? {} : { slug },
      });
      return renderToStaticMarkup(<>{element}</>);
    },
  };
}

export const brokenProviders = createProviderRegistry([]);

// The landing page's rail of collections, rendered to the markup a visitor receives.
export async function railFor(
  providers = storageRegistry(() => storage),
): Promise<string> {
  const [section] =
    createPublicCollectionsEntrypoint(providers, chains).homeSections ?? [];
  const element = await section?.render();
  return renderToStaticMarkup(<ScenesProvider>{element}</ScenesProvider>);
}
