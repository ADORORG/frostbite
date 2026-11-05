import {
  assets,
  authUsers,
  collectionItems,
  collections,
  createDatabaseClient,
  createDatabasePool,
  creatorApplications,
  parseDatabaseEnvironment,
  runMigrations,
  uploadIntents,
} from "@frostbite/database";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  seedReadyCollection,
  seededChain,
} from "../src/collection-database.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const now = new Date("2026-10-10T12:00:00.000Z");

beforeAll(() => runMigrations(environment));
afterAll(async () => {
  await database.delete(collectionItems);
  await database.delete(collections);
  await database.delete(assets);
  await database.delete(uploadIntents);
  await database.delete(creatorApplications);
  await database.delete(authUsers);
  await pool.end();
});

describe("ready collection fixture", () => {
  it("seeds an approved creator's collection with a cover and one image per planned item", async () => {
    const seed = await seedReadyCollection(database, { now, plannedSupply: 3 });
    const [row] = await database
      .select()
      .from(collections)
      .where(eq(collections.id, seed.collectionId));
    expect(row).toMatchObject({
      chainId: seededChain,
      coverAssetId: seed.cover,
      description: "About",
      ownerUserId: seed.ownerUserId,
      plannedSupply: 3,
      revision: seed.revision,
    });
    const items = await database
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, seed.collectionId));
    expect(items.map(({ position }) => position).sort()).toEqual([1, 2, 3]);
    expect(new Set(items.map(({ imageAssetId }) => imageAssetId)).size).toBe(3);
  });

  it("defaults to a single item", async () => {
    const seed = await seedReadyCollection(database, { now });
    expect(
      await database
        .select()
        .from(collectionItems)
        .where(eq(collectionItems.collectionId, seed.collectionId)),
    ).toHaveLength(1);
  });
});
