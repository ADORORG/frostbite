import { collections } from "@frostbite/database";
import { eq } from "drizzle-orm";

import { database, repository, seedAsset, seedUser } from "./database.ts";
import { draft, itemFor, mutation, newId } from "./fixtures.ts";

export async function seeded(plannedSupply = 5) {
  const owner = await seedUser();
  const created = await repository.create({
    ...mutation(owner),
    collectionId: newId(),
    draft: draft({ plannedSupply }),
  });
  if (created.kind !== "created") throw new Error(`got ${created.kind}`);
  return {
    collectionId: created.aggregate.collection.id,
    ownerUserId: owner,
  };
}

export async function add(
  seed: Awaited<ReturnType<typeof seeded>>,
  imageAssetId: string,
  context: Partial<ReturnType<typeof mutation>> & { itemLimit?: number } = {},
) {
  const { itemLimit = 100, ...rest } = context;
  return repository.addItem({
    ...mutation(seed.ownerUserId),
    collectionId: seed.collectionId,
    item: itemFor(imageAssetId),
    itemId: newId(),
    itemLimit,
    ...rest,
  });
}

export async function revisionOf(collectionId: string) {
  const [row] = await database
    .select({ revision: collections.revision })
    .from(collections)
    .where(eq(collections.id, collectionId));
  return row?.revision;
}

export const image = (owner: Parameters<typeof seedAsset>[0]) =>
  seedAsset(owner, "collection-item-artwork");
