import { creatorApplications } from "@ador/database/schema/creator-admission";
import { assets, uploadIntents } from "@ador/database/schema/uploads";
import { collections } from "@ador/database/schema/collections";
import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@ador/database/connection";
import {
  collectionAssetPurposes,
  type CollectionDraft,
} from "@ador/shared/collections";
import { and, eq, inArray, sql } from "drizzle-orm";

type AssetPurpose =
  (typeof collectionAssetPurposes)[keyof typeof collectionAssetPurposes];

export interface AssetReference {
  readonly id: string;
  readonly purpose: AssetPurpose;
}

// Only an approved creator may change a draft. The check runs inside the mutation's transaction and
// takes a shared lock on the application row, so a suspension or revocation cannot commit between the
// check and the change: it waits for the change to finish, and applies after it.
export async function isApprovedCreator(
  transaction: DatabaseTransaction,
  userId: string,
): Promise<boolean> {
  const [application] = await transaction
    .select({ state: creatorApplications.state })
    .from(creatorApplications)
    .where(eq(creatorApplications.applicantUserId, userId))
    .for("share")
    .limit(1);
  return application?.state === "approved";
}

export function draftAssetReferences(
  draft: Pick<CollectionDraft, "bannerAssetId" | "coverAssetId">,
): AssetReference[] {
  return [
    ...(draft.coverAssetId === null
      ? []
      : [{ id: draft.coverAssetId, purpose: collectionAssetPurposes.cover }]),
    ...(draft.bannerAssetId === null
      ? []
      : [{ id: draft.bannerAssetId, purpose: collectionAssetPurposes.banner }]),
  ];
}

const assetPurposes: readonly string[] = Object.values(collectionAssetPurposes);
const isAssetPurpose = (purpose: string): purpose is AssetPurpose =>
  assetPurposes.includes(purpose);

export interface ValidAsset {
  readonly contentSha256: string;
  readonly id: string;
  readonly purpose: AssetPurpose;
}

// The references that are processed assets of the owner uploaded for the purpose they are used for,
// with the content hash the processing recorded. A reference to someone else's asset is absent, exactly
// like a missing one, so existence is never disclosed.
export async function findValidAssets(
  transaction: DatabaseTransaction,
  ownerUserId: string,
  references: readonly AssetReference[],
): Promise<readonly ValidAsset[]> {
  if (references.length === 0) return [];
  const rows = await transaction
    .select({
      contentSha256: assets.contentSha256,
      id: assets.id,
      purpose: uploadIntents.purpose,
      state: assets.processingState,
      userId: assets.userId,
    })
    .from(assets)
    .innerJoin(uploadIntents, eq(uploadIntents.id, assets.uploadIntentId))
    .where(
      inArray(
        assets.id,
        references.map(({ id }) => id),
      ),
    );
  const wanted = new Set(
    references.map(({ id, purpose }) => `${id}:${purpose}`),
  );
  return rows.flatMap(({ contentSha256, id, purpose, state, userId }) =>
    state === "processed" &&
    userId === ownerUserId &&
    contentSha256 !== null &&
    isAssetPurpose(purpose) &&
    wanted.has(`${id}:${purpose}`)
      ? [{ contentSha256, id, purpose }]
      : [],
  );
}

// The first reference that is not a valid asset of the owner for its purpose, or null.
export async function firstInvalidAsset(
  transaction: DatabaseTransaction,
  ownerUserId: string,
  references: readonly AssetReference[],
): Promise<string | null> {
  const valid = new Set(
    (await findValidAssets(transaction, ownerUserId, references)).map(
      ({ id, purpose }) => `${id}:${purpose}`,
    ),
  );
  const invalid = references.find(
    ({ id, purpose }) => !valid.has(`${id}:${purpose}`),
  );
  return invalid?.id ?? null;
}

// The creator's own collection, locked for the rest of the transaction, or undefined.
async function lockCollection(
  transaction: DatabaseTransaction,
  ownerUserId: string,
  collectionId: string,
) {
  const [row] = await transaction
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.id, collectionId),
        eq(collections.ownerUserId, ownerUserId),
      ),
    )
    .for("update")
    .limit(1);
  return row;
}

export async function lockCreation(
  transaction: DatabaseTransaction,
  ownerUserId: string,
  idempotencyKey: string,
): Promise<void> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${ownerUserId}|${idempotencyKey}`}, 0))`,
  );
}

// Serialises every request that carries one idempotency key, so two concurrent requests with the same
// key cannot both pass the replay check and then race to record the same key.
export async function lockIdempotencyKey(
  transaction: DatabaseTransaction,
  idempotencyKey: string,
): Promise<void> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`review|${idempotencyKey}`}, 0))`,
  );
}

export type LockedCollection = NonNullable<
  Awaited<ReturnType<typeof lockCollection>>
>;

// Runs `work` in one transaction over the creator's own collection, locked so that changes to one
// collection are serialised, and only for a creator who is still approved. An unknown or foreign
// collection is `not-found`, and a creator who is not approved is `not-eligible`, before `work` runs.
export function editCollection<Result>(
  database: DatabaseClient,
  ownerUserId: string,
  collectionId: string,
  work: (
    transaction: DatabaseTransaction,
    locked: LockedCollection,
  ) => Promise<Result>,
): Promise<Result | { readonly kind: "not-eligible" | "not-found" }> {
  return database.transaction(async (transaction) => {
    const locked = await lockCollection(transaction, ownerUserId, collectionId);
    if (locked === undefined) return { kind: "not-found" } as const;
    if (!(await isApprovedCreator(transaction, ownerUserId)))
      return { kind: "not-eligible" } as const;
    return work(transaction, locked);
  });
}
