import { collectionItems } from "@ador/database";
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
import { mutation, newId } from "./support/fixtures.ts";
import { add, image, revisionOf, seeded } from "./support/items.ts";

useCollectionDatabase();

describe("adding items", () => {
  it("appends in order, bumping the collection revision each time", async () => {
    const seed = await seeded();
    for (let index = 0; index < 3; index += 1) {
      const added = await add(seed, await image(seed.ownerUserId));
      if (added.kind !== "added") throw new Error(`got ${added.kind}`);
      expect(added.item.position).toBe(index + 1);
    }
    expect(await revisionOf(seed.collectionId)).toBe(4);
    const found = await repository.find(seed);
    expect(found?.items.map(({ position }) => position)).toEqual([1, 2, 3]);
  });

  it("keeps positions increasing after a removal instead of renumbering", async () => {
    const seed = await seeded();
    const first = await add(seed, await image(seed.ownerUserId));
    await add(seed, await image(seed.ownerUserId));
    if (first.kind !== "added") throw new Error(`got ${first.kind}`);
    await repository.removeItem({
      changedAt: new Date(),
      collectionId: seed.collectionId,
      itemId: first.item.id,
      ownerUserId: seed.ownerUserId,
    });
    const third = await add(seed, await image(seed.ownerUserId));
    if (third.kind !== "added") throw new Error(`got ${third.kind}`);
    expect(third.item.position).toBe(3);
    expect(
      (await repository.find(seed))?.items.map(({ position }) => position),
    ).toEqual([2, 3]);
  });

  it("replays a repeated request, refuses a changed one, and does not add twice", async () => {
    const seed = await seeded();
    const asset = await image(seed.ownerUserId);
    const context = mutation(seed.ownerUserId);
    const first = await add(seed, asset, context);
    const again = await add(seed, asset, context);
    if (first.kind !== "added" || again.kind !== "replayed")
      throw new Error(`got ${first.kind} then ${again.kind}`);
    expect(again.item.id).toBe(first.item.id);
    expect([first.revision, again.revision]).toEqual([2, 2]);
    expect(
      await add(seed, asset, {
        ...context,
        requestFingerprint: "e".repeat(64),
      }),
    ).toEqual({
      kind: "conflict",
    });
    expect(await database.select().from(collectionItems)).toHaveLength(1);
    expect(await revisionOf(seed.collectionId)).toBe(2);
  });

  it("stops at the planned supply and at the item limit", async () => {
    const seed = await seeded(2);
    await add(seed, await image(seed.ownerUserId));
    await add(seed, await image(seed.ownerUserId));
    expect(await add(seed, await image(seed.ownerUserId))).toEqual({
      kind: "supply-reached",
    });
    const roomy = await seeded(50);
    await add(roomy, await image(roomy.ownerUserId), { itemLimit: 1 });
    expect(
      await add(roomy, await image(roomy.ownerUserId), { itemLimit: 1 }),
    ).toEqual({
      kind: "item-limit",
    });
  });

  it("never exceeds the planned supply under concurrent adds", async () => {
    const seed = await seeded(3);
    const assets = await Promise.all(
      Array.from({ length: 8 }, () => image(seed.ownerUserId)),
    );
    const results = await Promise.all(assets.map((asset) => add(seed, asset)));
    expect(results.filter(({ kind }) => kind === "added")).toHaveLength(3);
    expect(
      results.filter(({ kind }) => kind === "supply-reached"),
    ).toHaveLength(5);
    const positions = (await repository.find(seed))?.items.map(
      ({ position }) => position,
    );
    expect(positions).toEqual([1, 2, 3]);
  });

  it("accepts only the creator's processed item artwork", async () => {
    const seed = await seeded();
    const other = await seedUser();
    const cases = [
      await seedAsset(other, "collection-item-artwork"),
      await seedAsset(seed.ownerUserId, "collection-item-artwork", "validated"),
      await seedAsset(seed.ownerUserId, "collection-artwork"),
      newId(),
    ];
    for (const assetId of cases)
      expect(await add(seed, assetId)).toEqual({
        assetId,
        kind: "invalid-asset",
      });
    expect(await database.select().from(collectionItems)).toHaveLength(0);
  });

  it("refuses another creator, an unknown collection, and a creator no longer approved", async () => {
    const seed = await seeded();
    const intruder = await seedUser();
    const asset = await image(intruder);
    expect(await add({ ...seed, ownerUserId: intruder }, asset)).toEqual({
      kind: "not-found",
    });
    expect(
      await add(
        { ...seed, collectionId: newId() },
        await image(seed.ownerUserId),
      ),
    ).toEqual({
      kind: "not-found",
    });
    await setApplicationState(seed.ownerUserId, "revoked");
    expect(await add(seed, await image(seed.ownerUserId))).toEqual({
      kind: "not-eligible",
    });
  });

  it("rejects an item that breaks the stored invariants", async () => {
    const seed = await seeded();
    const added = await add(seed, await image(seed.ownerUserId));
    if (added.kind !== "added") throw new Error(`got ${added.kind}`);
    const attempt = (values: Partial<typeof collectionItems.$inferInsert>) =>
      database
        .update(collectionItems)
        .set(values)
        .where(eq(collectionItems.id, added.item.id));
    await expect(attempt({ position: 0 })).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "collection_items_position_positive",
      },
    });
    await expect(
      attempt({ description: "x".repeat(1_001) }),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "collection_items_description_bounded",
      },
    });
    for (const attributes of [
      Array.from({ length: 33 }, (_, index) => ({
        trait: `t${index}`,
        value: "v",
      })),
    ])
      await expect(attempt({ attributes })).rejects.toMatchObject({
        cause: {
          code: "23514",
          constraint: "collection_items_attributes_bounded",
        },
      });
    await expect(attempt({ name: " x " })).rejects.toMatchObject({
      cause: { code: "23514", constraint: "collection_items_name_valid" },
    });
  });
});
