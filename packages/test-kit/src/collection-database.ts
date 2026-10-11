import {
  collectionItems,
  collections,
  type DatabaseClient,
} from "@ador/database";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";

import { seedCreatorUser, seedUploadedAsset } from "./creator-database.ts";

// A CAIP-2 chain reference for fixtures that only need some valid chain (Bitcoin signet).
export const seededChain = "bip122:00000008819873e925422c1ff0f99f7c";

const fingerprint = "a".repeat(64);

// An approved creator with a collection that is ready to submit: a description, a cover image, and as
// many items as its planned supply, each with its own processed image. Rows are written directly, so
// a suite can seed what it needs without depending on the collections package.
export async function seedReadyCollection(
  database: DatabaseClient,
  input: { readonly now: Date; readonly plannedSupply?: number },
) {
  const { now, plannedSupply = 1 } = input;
  const ownerUserId = await seedCreatorUser(database);
  const cover = await seedUploadedAsset(database, {
    now,
    purpose: "collection-artwork",
    userId: ownerUserId,
  });
  const collectionId = uuidV7Schema.parse(createUuidV7());
  await database.insert(collections).values({
    chainId: seededChain,
    coverAssetId: cover,
    description: "About",
    id: collectionId,
    idempotencyKey: `seed-${collectionId}`,
    name: "First light",
    ownerUserId,
    plannedSupply,
    provenance: "",
    requestFingerprint: fingerprint,
  });
  for (let position = 1; position <= plannedSupply; position += 1) {
    const itemId = createUuidV7();
    await database.insert(collectionItems).values({
      attributes: [],
      collectionId,
      description: "",
      id: itemId,
      idempotencyKey: `seed-${itemId}`,
      imageAssetId: await seedUploadedAsset(database, {
        now,
        purpose: "collection-item-artwork",
        userId: ownerUserId,
      }),
      name: `Item ${String(position)}`,
      position,
      requestFingerprint: fingerprint,
    });
  }
  return { collectionId, cover, ownerUserId, revision: 1 };
}
