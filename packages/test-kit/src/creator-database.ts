import {
  assetDerivatives,
  assets,
  authUsers,
  creatorApplications,
  uploadIntents,
  type DatabaseClient,
} from "@ador/database";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import type { UploadPurpose } from "@ador/shared/uploads";
import { eq } from "drizzle-orm";

export type CreatorApplicationState =
  typeof creatorApplications.$inferSelect.state;
export type SeededAssetState = typeof assets.$inferSelect.processingState;

// A complete creator application that nothing reads; seeding an application only needs a valid record.
export const creatorApplicationFixture = {
  contentDeclarationAccepted: true,
  displayName: "Creator",
  expectedLaunchSize: "100",
  expectedLaunchTiming: "soon",
  jurisdictionAcknowledged: true,
  portfolioLinks: [],
  projectSummary: "A project",
  provenanceDeclarationAccepted: true,
  rightsDeclarationAccepted: true,
};

const dayMilliseconds = 86_400_000;

// A user, and unless `state` is null, a creator application in that state (`approved` lets the user
// change collection drafts). The application content is a complete record that nothing reads.
export async function seedCreatorUser(
  database: DatabaseClient,
  state: CreatorApplicationState | null = "approved",
) {
  const userId = uuidV7Schema.parse(createUuidV7());
  await database
    .insert(authUsers)
    .values({ email: `${userId}@example.test`, id: userId, name: "Creator" });
  if (state !== null)
    await database.insert(creatorApplications).values({
      applicantUserId: userId,
      draft: creatorApplicationFixture,
      id: createUuidV7(),
      state,
    });
  return userId;
}

export async function setCreatorApplicationState(
  database: DatabaseClient,
  userId: string,
  state: CreatorApplicationState,
) {
  await database
    .update(creatorApplications)
    .set({ state })
    .where(eq(creatorApplications.applicantUserId, userId));
}

// An asset of the user in the given state, uploaded for the given purpose. A `processed` or
// `validated` asset carries the validation evidence the database requires; a `processed` one also
// the processing time.
export async function seedUploadedAsset(
  database: DatabaseClient,
  input: {
    readonly now: Date;
    readonly purpose: UploadPurpose;
    readonly state?: SeededAssetState;
    readonly userId: string;
  },
) {
  const { now, purpose, state = "processed", userId } = input;
  const intentId = createUuidV7();
  const assetId = uuidV7Schema.parse(createUuidV7());
  await database.insert(uploadIntents).values({
    byteLength: 100,
    cleanupEligibleAt: new Date(now.getTime() + dayMilliseconds),
    contentType: "image/png",
    expiresAt: new Date(now.getTime() + 60_000),
    id: intentId,
    idempotencyKey: `upload-${intentId}`,
    objectKey: `drafts/${intentId}`,
    purpose,
    requestFingerprint: "b".repeat(64),
    retainUntil: new Date(now.getTime() + 30 * dayMilliseconds),
    state: "completed",
    storageProviderId: "test-storage",
    userId,
  });
  const validated = state === "processed" || state === "validated";
  await database.insert(assets).values({
    contentSha256: validated ? "c".repeat(64) : null,
    detectedContentType: validated ? "image/png" : null,
    heightPixels: validated ? 16 : null,
    id: assetId,
    objectKey: `drafts/${intentId}`,
    observedByteLength: 100,
    observedContentType: "image/png",
    observedEntityTag: "etag",
    observedLastModifiedAt: now,
    processingCompletedAt: state === "processed" ? now : null,
    processingState: state,
    storageProviderId: "test-storage",
    uploadIntentId: intentId,
    userId,
    validatedEntityTag: validated ? "etag" : null,
    validationCompletedAt: state === "pending-validation" ? null : now,
    validatorVersion: state === "pending-validation" ? null : "structural-v1",
    widthPixels: validated ? 24 : null,
  });
  return assetId;
}

// A stored rendition of an asset, so a preview has something to sign.
export async function seedDerivative(
  database: DatabaseClient,
  assetId: string,
  kind: "preview" | "thumbnail",
) {
  const objectKey = `derivatives/${assetId}/${kind}.webp`;
  await database.insert(assetDerivatives).values({
    assetId,
    byteLength: 10,
    contentSha256: "d".repeat(64),
    contentType: "image/webp",
    heightPixels: 8,
    id: createUuidV7(),
    kind,
    objectKey,
    specVersion: "test-spec",
    storageProviderId: "test-storage",
    widthPixels: 12,
  });
  return objectKey;
}
