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

export function draftAssetReferences(draft: CollectionDraft): AssetReference[] {
  return [
    ...(draft.coverAssetId === null
      ? []
      : [{ id: draft.coverAssetId, purpose: collectionAssetPurposes.cover }]),
    ...(draft.bannerAssetId === null
      ? []
      : [{ id: draft.bannerAssetId, purpose: collectionAssetPurposes.banner }]),
  ];
}

// The first reference that is not a processed asset of the owner uploaded for the purpose it is
// used for, or null. A reference to someone else's asset is reported exactly like a missing one.
export async function firstInvalidAsset(
  transaction: DatabaseTransaction,
  ownerUserId: string,
  references: readonly AssetReference[],
): Promise<string | null> {
  if (references.length === 0) return null;
  const rows = await transaction
    .select({
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
  const valid = new Set(
    rows
      .filter(
        ({ state, userId }) => state === "processed" && userId === ownerUserId,
      )
      .map(({ id, purpose }) => `${id}:${purpose}`),
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
