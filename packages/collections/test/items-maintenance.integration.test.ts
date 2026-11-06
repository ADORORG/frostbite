import { collectionItems } from "@frostbite/database";
import { describe, expect, it } from "vitest";

import {
  database,
  repository,
  seedAsset,
  seedUser,
  setApplicationState,
  useCollectionDatabase,
} from "./support/database.ts";
import { draft, itemFor, mutation, newId } from "./support/fixtures.ts";
import { add, image, revisionOf, seeded } from "./support/items.ts";

useCollectionDatabase();

async function seededWithItem() {
  const seed = await seeded();
  const added = await add(seed, await image(seed.ownerUserId));
  if (added.kind !== "added") throw new Error(`got ${added.kind}`);
  return { added, seed };
}

describe("updating items", () => {
  it("updates an item in place, keeping its position, and bumps the revision", async () => {
    const { added, seed } = await seededWithItem();
    const next = await image(seed.ownerUserId);
    const updated = await repository.updateItem({
      changedAt: new Date(),
      collectionId: seed.collectionId,
      item: itemFor(next, { attributes: [], name: "Renamed" }),
      itemId: added.item.id,
      ownerUserId: seed.ownerUserId,
    });
    if (updated.kind !== "updated") throw new Error(`got ${updated.kind}`);
    expect(updated.revision).toBe(3);
    expect(updated.item).toMatchObject({
      imageAssetId: next,
      name: "Renamed",
      position: 1,
    });
    expect(await revisionOf(seed.collectionId)).toBe(3);
  });

  it("refuses an unknown item, a foreign collection, a bad asset, and an ineligible creator", async () => {
    const { added, seed } = await seededWithItem();
    const base = {
      changedAt: new Date(),
      collectionId: seed.collectionId,
      item: itemFor(added.item.imageAssetId),
      itemId: added.item.id,
      ownerUserId: seed.ownerUserId,
    };
    expect(await repository.updateItem({ ...base, itemId: newId() })).toEqual({
      kind: "not-found",
    });
    expect(
      await repository.updateItem({ ...base, ownerUserId: await seedUser() }),
    ).toEqual({ kind: "not-found" });
    const wrong = await seedAsset(seed.ownerUserId, "collection-banner");
    expect(
      await repository.updateItem({ ...base, item: itemFor(wrong) }),
    ).toEqual({ assetId: wrong, kind: "invalid-asset" });
    await setApplicationState(seed.ownerUserId, "suspended");
    expect(await repository.updateItem(base)).toEqual({ kind: "not-eligible" });
    expect(await revisionOf(seed.collectionId)).toBe(2);
  });
});

describe("removing items", () => {
  it("removes an item once, treats a repeat as a no-op, and protects other creators' items", async () => {
    const { added, seed } = await seededWithItem();
    const base = {
      changedAt: new Date(),
      collectionId: seed.collectionId,
      itemId: added.item.id,
    };
    const intruder = await seedUser();
    expect(
      await repository.removeItem({ ...base, ownerUserId: intruder }),
    ).toEqual({ kind: "not-found" });
    expect(await database.select().from(collectionItems)).toHaveLength(1);

    expect(
      await repository.removeItem({ ...base, ownerUserId: seed.ownerUserId }),
    ).toEqual({ kind: "removed", revision: 3 });
    expect(await revisionOf(seed.collectionId)).toBe(3);
    // A repeat removes nothing: the same success, and the revision does not move.
    expect(
      await repository.removeItem({ ...base, ownerUserId: seed.ownerUserId }),
    ).toEqual({ kind: "removed", revision: 3 });
    expect(await revisionOf(seed.collectionId)).toBe(3);

    await setApplicationState(seed.ownerUserId, "suspended");
    expect(
      await repository.removeItem({ ...base, ownerUserId: seed.ownerUserId }),
    ).toEqual({ kind: "not-eligible" });
  });
});

describe("reading collections", () => {
  it("lists only the creator's own drafts, newest first, with item counts and a limit", async () => {
    const seed = await seeded();
    await add(seed, await image(seed.ownerUserId));
    const second = await repository.create({
      ...mutation(seed.ownerUserId),
      changedAt: new Date(Date.now() + 60_000),
      collectionId: newId(),
      draft: draft({ name: "Second" }),
    });
    expect(second.kind).toBe("created");
    await seeded();
    const list = await repository.listForOwner({
      limit: 10,
      ownerUserId: seed.ownerUserId,
    });
    expect(list.map(({ itemCount, name }) => [name, itemCount])).toEqual([
      ["Second", 0],
      ["First light", 1],
    ]);
    expect(
      await repository.listForOwner({
        limit: 1,
        ownerUserId: seed.ownerUserId,
      }),
    ).toHaveLength(1);
  });

  it("finds a draft only for its creator", async () => {
    const seed = await seeded();
    expect(await repository.find(seed)).not.toBeNull();
    expect(
      await repository.find({
        collectionId: seed.collectionId,
        ownerUserId: await seedUser(),
      }),
    ).toBeNull();
    expect(
      await repository.find({
        collectionId: newId(),
        ownerUserId: seed.ownerUserId,
      }),
    ).toBeNull();
  });

  it("still reads a draft after its creator lost approval", async () => {
    const seed = await seeded();
    await setApplicationState(seed.ownerUserId, "suspended");
    expect(await repository.find(seed)).not.toBeNull();
    expect(
      await repository.listForOwner({
        limit: 5,
        ownerUserId: seed.ownerUserId,
      }),
    ).toHaveLength(1);
  });
});
