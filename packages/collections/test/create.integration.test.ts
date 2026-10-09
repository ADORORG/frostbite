import { collections } from "@ador/database";
import { describe, expect, it } from "vitest";

import {
  database,
  repository,
  seedAsset,
  seedUser,
  setApplicationState,
  useCollectionDatabase,
} from "./support/database.ts";
import { draft, mutation, newId } from "./support/fixtures.ts";

useCollectionDatabase();

async function create(
  ownerUserId: ReturnType<typeof newId>,
  overrides: Parameters<typeof draft>[0] = {},
  context: Partial<ReturnType<typeof mutation>> = {},
) {
  return repository.create({
    ...mutation(ownerUserId),
    collectionId: newId(),
    draft: draft(overrides),
    ...context,
  });
}

describe("creating a collection draft", () => {
  it("stores the draft for an approved creator, at revision 1 and with no items", async () => {
    const owner = await seedUser();
    const result = await create(owner);
    if (result.kind !== "created") throw new Error(`got ${result.kind}`);
    expect(result.aggregate.collection).toMatchObject({
      name: "First light",
      plannedSupply: 5,
      revision: 1,
    });
    expect(result.aggregate.items).toEqual([]);
  });

  it("replays the same request and refuses a different request under one key", async () => {
    const owner = await seedUser();
    const context = mutation(owner);
    const first = await create(owner, {}, context);
    const again = await create(owner, {}, context);
    if (first.kind !== "created" || again.kind !== "replayed")
      throw new Error(`got ${first.kind} then ${again.kind}`);
    expect(again.aggregate.collection.id).toBe(first.aggregate.collection.id);
    expect(
      await create(
        owner,
        { name: "Different" },
        { ...context, requestFingerprint: "d".repeat(64) },
      ),
    ).toEqual({ kind: "conflict" });
    expect(await database.select().from(collections)).toHaveLength(1);
  });

  it("scopes an idempotency key to its creator", async () => {
    const [one, two] = [await seedUser(), await seedUser()];
    const shared = { idempotencyKey: "shared-request-key-1" };
    const first = await create(one, {}, shared);
    const second = await create(two, {}, shared);
    expect([first.kind, second.kind]).toEqual(["created", "created"]);
  });

  it.each([
    ["never applied", null],
    ["still a draft", "draft"],
    ["under review", "under-review"],
    ["asked for changes", "changes-requested"],
    ["rejected", "rejected"],
    ["suspended", "suspended"],
    ["revoked", "revoked"],
  ] as const)("refuses a creator who %s", async (_label, state) => {
    const owner = await seedUser(state);
    expect(await create(owner)).toEqual({ kind: "not-eligible" });
    expect(await database.select().from(collections)).toHaveLength(0);
  });

  it("refuses a creator suspended since they were approved", async () => {
    const owner = await seedUser();
    await setApplicationState(owner, "suspended");
    expect(await create(owner)).toEqual({ kind: "not-eligible" });
  });

  it("accepts a processed cover and banner of the right purposes", async () => {
    const owner = await seedUser();
    const cover = await seedAsset(owner, "collection-artwork");
    const banner = await seedAsset(owner, "collection-banner");
    const result = await create(owner, {
      bannerAssetId: banner,
      coverAssetId: cover,
    });
    expect(result.kind).toBe("created");
  });

  it("refuses an asset that is another creator's, unprocessed, of the wrong purpose, or missing", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const foreign = await seedAsset(other, "collection-artwork");
    const unprocessed = await seedAsset(
      owner,
      "collection-artwork",
      "validated",
    );
    const wrongPurpose = await seedAsset(owner, "creator-avatar");
    for (const assetId of [foreign, unprocessed, wrongPurpose, newId()]) {
      expect(await create(owner, { coverAssetId: assetId })).toEqual({
        assetId,
        kind: "invalid-asset",
      });
    }
    // A banner may not be used as a cover, nor the reverse.
    const banner = await seedAsset(owner, "collection-banner");
    expect(await create(owner, { coverAssetId: banner })).toEqual({
      assetId: banner,
      kind: "invalid-asset",
    });
    expect(await database.select().from(collections)).toHaveLength(0);
  });

  it("creates exactly one draft when the same request arrives concurrently", async () => {
    const owner = await seedUser();
    const context = mutation(owner);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => create(owner, {}, context)),
    );
    expect(results.filter(({ kind }) => kind === "created")).toHaveLength(1);
    expect(results.filter(({ kind }) => kind === "replayed")).toHaveLength(4);
    expect(await database.select().from(collections)).toHaveLength(1);
  });
});
