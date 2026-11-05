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
import { mutation, newId, rowFor } from "./support/fixtures.ts";
import { imageNamed, runImport } from "./support/imports.ts";
import { revisionOf, seeded } from "./support/items.ts";

useCollectionDatabase();

const stored = () => database.select().from(collectionItems);

describe("importing items", () => {
  it("adds every row in order, after the items already there, and counts as one change", async () => {
    const seed = await seeded(5);
    const first = await imageNamed(seed.ownerUserId, "first.png");
    const second = await imageNamed(seed.ownerUserId, "second.png");
    const result = await runImport(seed, [
      rowFor("first.png"),
      rowFor("SECOND.PNG"),
    ]);
    if (result.kind !== "imported") throw new Error(`got ${result.kind}`);
    expect(result.revision).toBe(2);
    expect(result.rows).toEqual([
      { imageAssetId: first, problems: [], row: 1 },
      { imageAssetId: second, problems: [], row: 2 },
    ]);
    const found = await repository.find(seed);
    expect(
      found?.items.map(({ imageAssetId, name, position }) => [
        position,
        name,
        imageAssetId,
      ]),
    ).toEqual([
      [1, "Item for first.png", first],
      [2, "Item for SECOND.PNG", second],
    ]);
    expect(found?.items[0]?.attributes).toEqual([
      { trait: "Colour", value: "Blue" },
    ]);
    expect(await revisionOf(seed.collectionId)).toBe(2);
  });

  it("continues the numbering after existing items", async () => {
    const seed = await seeded(5);
    await imageNamed(seed.ownerUserId, "a.png");
    await runImport(seed, [rowFor("a.png")]);
    await imageNamed(seed.ownerUserId, "b.png");
    await runImport(seed, [rowFor("b.png")]);
    expect(
      (await repository.find(seed))?.items.map(({ position }) => position),
    ).toEqual([1, 2]);
  });

  it("uses the newest upload when a file name was uploaded more than once", async () => {
    const seed = await seeded(5);
    await imageNamed(seed.ownerUserId, "same.png");
    const newest = await imageNamed(seed.ownerUserId, "same.png");
    const result = await runImport(seed, [rowFor("same.png")]);
    if (result.kind !== "imported") throw new Error(`got ${result.kind}`);
    expect(result.rows[0]?.imageAssetId).toBe(newest);
  });

  it("writes nothing when any image cannot be found, and says which rows and why", async () => {
    const seed = await seeded(5);
    await imageNamed(seed.ownerUserId, "here.png");
    const result = await runImport(seed, [
      rowFor("here.png"),
      rowFor("missing.png"),
    ]);
    expect(result).toEqual({
      kind: "report",
      rows: [
        { imageAssetId: expect.any(String), problems: [], row: 1 },
        { imageAssetId: null, problems: ["image-not-found"], row: 2 },
      ],
    });
    expect(await stored()).toHaveLength(0);
    expect(await revisionOf(seed.collectionId)).toBe(1);
  });

  it("only finds the creator's own, processed images made for items", async () => {
    const seed = await seeded(5);
    const other = await seedUser();
    await imageNamed(other, "theirs.png");
    await seedAsset(
      seed.ownerUserId,
      "collection-artwork",
      "processed",
      "cover.png",
    );
    await seedAsset(
      seed.ownerUserId,
      "collection-item-artwork",
      "pending-validation",
      "pending.png",
    );
    const result = await runImport(seed, [
      rowFor("theirs.png"),
      rowFor("cover.png"),
      rowFor("pending.png"),
    ]);
    if (result.kind !== "report") throw new Error(`got ${result.kind}`);
    expect(result.rows.map(({ problems }) => problems)).toEqual([
      ["image-not-found"],
      ["image-not-found"],
      ["image-not-found"],
    ]);
  });

  it("refuses rows past the planned supply and writes none of them", async () => {
    const seed = await seeded(2);
    for (const name of ["a.png", "b.png", "c.png"])
      await imageNamed(seed.ownerUserId, name);
    const result = await runImport(seed, [
      rowFor("a.png"),
      rowFor("b.png"),
      rowFor("c.png"),
    ]);
    if (result.kind !== "report") throw new Error(`got ${result.kind}`);
    expect(result.rows.map(({ problems }) => problems)).toEqual([
      [],
      [],
      ["over-supply"],
    ]);
    expect(await stored()).toHaveLength(0);
  });

  it("counts the items already in the collection against the supply", async () => {
    const seed = await seeded(2);
    await imageNamed(seed.ownerUserId, "a.png");
    await imageNamed(seed.ownerUserId, "b.png");
    await runImport(seed, [rowFor("a.png")]);
    const result = await runImport(seed, [rowFor("b.png"), rowFor("a.png")]);
    if (result.kind !== "report") throw new Error(`got ${result.kind}`);
    expect(result.rows.map(({ problems }) => problems)).toEqual([
      [],
      ["over-supply"],
    ]);
  });

  it("reports without writing on a dry run, even when every row would be added", async () => {
    const seed = await seeded(5);
    await imageNamed(seed.ownerUserId, "a.png");
    const result = await runImport(seed, [rowFor("a.png")], { dryRun: true });
    expect(result).toEqual({
      kind: "report",
      rows: [{ imageAssetId: expect.any(String), problems: [], row: 1 }],
    });
    expect(await stored()).toHaveLength(0);
    expect(await revisionOf(seed.collectionId)).toBe(1);
  });

  it("replays a repeated import, refuses a changed one, and never adds twice", async () => {
    const seed = await seeded(5);
    await imageNamed(seed.ownerUserId, "a.png");
    await imageNamed(seed.ownerUserId, "b.png");
    const context = mutation(seed.ownerUserId);
    const rows = [rowFor("a.png"), rowFor("b.png")];
    const first = await runImport(seed, rows, context);
    const again = await runImport(seed, rows, context);
    if (first.kind !== "imported" || again.kind !== "replayed")
      throw new Error(`got ${first.kind} then ${again.kind}`);
    expect(again.rows).toEqual(first.rows);
    expect(again.revision).toBe(first.revision);
    expect(
      await runImport(seed, rows, {
        ...context,
        requestFingerprint: "e".repeat(64),
      }),
    ).toEqual({ kind: "conflict" });
    expect(await stored()).toHaveLength(2);
  });

  it("adds only once when the same import arrives twice at the same moment", async () => {
    const seed = await seeded(5);
    await imageNamed(seed.ownerUserId, "a.png");
    const context = mutation(seed.ownerUserId);
    const kinds = (
      await Promise.all([
        runImport(seed, [rowFor("a.png")], context),
        runImport(seed, [rowFor("a.png")], context),
      ])
    )
      .map(({ kind }) => kind)
      .sort();
    expect(kinds).toEqual(["imported", "replayed"]);
    expect(await stored()).toHaveLength(1);
  });

  it("stops at the item limit", async () => {
    const seed = await seeded(5);
    await imageNamed(seed.ownerUserId, "a.png");
    await imageNamed(seed.ownerUserId, "b.png");
    expect(
      await runImport(seed, [rowFor("a.png"), rowFor("b.png")], {
        itemLimit: 1,
      }),
    ).toEqual({ kind: "item-limit" });
    expect(await stored()).toHaveLength(0);
  });

  it("is refused for another creator's collection and for a creator who is no longer approved", async () => {
    const seed = await seeded(5);
    await imageNamed(seed.ownerUserId, "a.png");
    const stranger = await seedUser();
    expect(
      await repository.importItems({
        ...mutation(stranger),
        collectionId: seed.collectionId,
        dryRun: false,
        itemLimit: 10,
        rows: [{ itemId: newId(), row: rowFor("a.png") }],
      }),
    ).toEqual({ kind: "not-found" });
    await setApplicationState(seed.ownerUserId, "suspended");
    expect(await runImport(seed, [rowFor("a.png")])).toEqual({
      kind: "not-eligible",
    });
    expect(await stored()).toHaveLength(0);
  });
});
