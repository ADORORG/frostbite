import { collections } from "@frostbite/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  repository,
  seedAsset,
  seedUser,
  setApplicationState,
  useCollectionDatabase,
} from "./support/database.ts";
import { draft, itemFor, mutation, newId, now } from "./support/fixtures.ts";

useCollectionDatabase();

async function seeded(overrides: Parameters<typeof draft>[0] = {}) {
  const owner = await seedUser();
  const created = await repository.create({
    ...mutation(owner),
    collectionId: newId(),
    draft: draft(overrides),
  });
  if (created.kind !== "created") throw new Error(`got ${created.kind}`);
  return { collection: created.aggregate.collection, owner };
}

function save(
  seed: Awaited<ReturnType<typeof seeded>>,
  changes: Parameters<typeof draft>[0],
  expectedRevision = seed.collection.revision,
  ownerUserId = seed.owner,
) {
  return repository.save({
    changedAt: new Date(now.getTime() + 1_000),
    collectionId: seed.collection.id,
    draft: draft(changes),
    expectedRevision,
    ownerUserId,
  });
}

describe("saving a collection draft", () => {
  it("applies the draft, bumps the revision, and stamps the change time", async () => {
    const seed = await seeded();
    const result = await save(seed, { name: "Renamed", plannedSupply: 9 });
    if (result.kind !== "saved") throw new Error(`got ${result.kind}`);
    expect(result.aggregate.collection).toMatchObject({
      name: "Renamed",
      plannedSupply: 9,
      revision: 2,
      updatedAt: new Date(now.getTime() + 1_000),
    });
  });

  it("refuses a save based on a stale revision and reports the current one", async () => {
    const seed = await seeded();
    await save(seed, { name: "Newer" });
    expect(await save(seed, { name: "Stale" })).toEqual({
      currentRevision: 2,
      kind: "revision-conflict",
    });
    const [row] = await database.select().from(collections);
    expect(row?.name).toBe("Newer");
  });

  it("lets exactly one of two concurrent saves of one revision win", async () => {
    const seed = await seeded();
    const results = await Promise.all([
      save(seed, { name: "A" }),
      save(seed, { name: "B" }),
    ]);
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "revision-conflict",
      "saved",
    ]);
  });

  it("does not reveal or change another creator's draft", async () => {
    const seed = await seeded();
    const intruder = await seedUser();
    expect(await save(seed, { name: "Hijack" }, 1, intruder)).toEqual({
      kind: "not-found",
    });
    expect(await save(seed, {}, 1, newId())).toEqual({ kind: "not-found" });
    const [row] = await database
      .select()
      .from(collections)
      .where(eq(collections.id, seed.collection.id));
    expect(row).toMatchObject({ name: "First light", revision: 1 });
  });

  it("refuses a creator who is no longer approved", async () => {
    const seed = await seeded();
    await setApplicationState(seed.owner, "suspended");
    expect(await save(seed, { name: "Renamed" })).toEqual({
      kind: "not-eligible",
    });
  });

  it("refuses to shrink the planned supply below the items already added", async () => {
    const seed = await seeded({ plannedSupply: 3 });
    for (let index = 0; index < 3; index += 1) {
      const image = await seedAsset(seed.owner, "collection-item-artwork");
      const added = await repository.addItem({
        ...mutation(seed.owner),
        collectionId: seed.collection.id,
        item: itemFor(image),
        itemId: newId(),
        itemLimit: 100,
      });
      expect(added.kind).toBe("added");
    }
    expect(await save(seed, { plannedSupply: 2 }, 4)).toEqual({
      itemCount: 3,
      kind: "supply-below-items",
    });
    const kept = await save(seed, { plannedSupply: 3 }, 4);
    expect(kept.kind).toBe("saved");
  });

  it("refuses an asset that is not the creator's processed asset of the right purpose", async () => {
    const seed = await seeded();
    const other = await seedUser();
    const foreign = await seedAsset(other, "collection-artwork");
    expect(await save(seed, { coverAssetId: foreign })).toEqual({
      assetId: foreign,
      kind: "invalid-asset",
    });
    const own = await seedAsset(seed.owner, "collection-artwork");
    const saved = await save(seed, { coverAssetId: own });
    expect(saved.kind).toBe("saved");
  });

  it("enforces the stored invariants in the database itself", async () => {
    const seed = await seeded();
    const attempt = (values: Partial<typeof collections.$inferInsert>) =>
      database
        .update(collections)
        .set(values)
        .where(eq(collections.id, seed.collection.id));
    const violates = (constraint: string) => ({
      cause: { code: "23514", constraint },
    });
    await expect(attempt({ plannedSupply: 0 })).rejects.toMatchObject(
      violates("collections_planned_supply_bounded"),
    );
    await expect(attempt({ plannedSupply: 1_000_001 })).rejects.toMatchObject(
      violates("collections_planned_supply_bounded"),
    );
    await expect(attempt({ name: " padded " })).rejects.toMatchObject(
      violates("collections_name_valid"),
    );
    await expect(attempt({ chainId: "not a chain" })).rejects.toMatchObject(
      violates("collections_chain_id_caip2"),
    );
    await expect(
      attempt({ description: "x".repeat(4_001) }),
    ).rejects.toMatchObject(violates("collections_text_bounded"));
    await expect(
      attempt({ provenance: "x".repeat(2_001) }),
    ).rejects.toMatchObject(violates("collections_text_bounded"));
    await expect(attempt({ revision: 0 })).rejects.toMatchObject(
      violates("collections_revision_positive"),
    );
  });
});
