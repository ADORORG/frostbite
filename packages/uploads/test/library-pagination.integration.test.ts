import { assets } from "@frostbite/database";
import { createUuidV7, uuidV7Schema } from "@frostbite/shared/identifiers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDrizzleAssetLibraryRepository } from "../src/adapters/drizzle-library-repository.ts";
import {
  database,
  seedMoreFor,
  seedValidated,
  useValidationDatabase,
} from "./support/validation-database.ts";

const library = createDrizzleAssetLibraryRepository(database);
useValidationDatabase();

async function firstAsset() {
  const seeded = await seedValidated();
  const [row] = await database
    .select({ userId: assets.userId })
    .from(assets)
    .where(eq(assets.id, seeded.assetId));
  if (row === undefined) throw new Error("seeded asset is missing");
  return { ...seeded, userId: uuidV7Schema.parse(row.userId) };
}

const setCreatedAt = (assetId: string, at: string) =>
  database
    .update(assets)
    .set({ createdAt: new Date(at) })
    .where(eq(assets.id, assetId));

describe("paging back through older assets", () => {
  describe("paging back through older assets", () => {
    const cursorAfter = (record: { createdAt: Date; id: string }) => ({
      createdAtMs: record.createdAt.getTime(),
      id: uuidV7Schema.parse(record.id),
    });

    it("continues from the last asset seen, newest first, without a gap or a repeat, to the end", async () => {
      const first = await firstAsset();
      const ids = [first.assetId];
      for (let day = 1; day <= 6; day += 1)
        ids.push(
          await seedMoreFor(first.userId, `2026-11-0${String(day)}T10:00:00Z`),
        );
      await setCreatedAt(first.assetId, "2026-10-01T10:00:00Z");
      const expected = [...ids.slice(1).reverse(), first.assetId];
      const seen: string[] = [];
      let before: ReturnType<typeof cursorAfter> | undefined;
      for (let page = 0; page < 5; page += 1) {
        const records = await library.listNewestForUser({
          ...(before === undefined ? {} : { before }),
          limit: 3,
          userId: first.userId,
        });
        if (records.length === 0) break;
        seen.push(...records.map(({ id }) => id));
        const last = records.at(-1);
        if (last === undefined) break;
        before = cursorAfter(last);
      }
      expect(seen).toEqual(expected);
    });

    it("does not skip or repeat assets made within the same millisecond, though their microseconds differ", async () => {
      const first = await firstAsset();
      const tied = [
        await seedMoreFor(first.userId, "2026-11-01T10:00:00.123111Z"),
        await seedMoreFor(first.userId, "2026-11-01T10:00:00.123999Z"),
        await seedMoreFor(first.userId, "2026-11-01T10:00:00.123500Z"),
      ];
      await setCreatedAt(first.assetId, "2026-10-01T10:00:00Z");
      const pageOne = await library.listNewestForUser({
        limit: 2,
        userId: first.userId,
      });
      const last = pageOne.at(-1);
      if (last === undefined) throw new Error("expected a page");
      const pageTwo = await library.listNewestForUser({
        before: cursorAfter(last),
        limit: 10,
        userId: first.userId,
      });
      const all = [...pageOne, ...pageTwo].map(({ id }) => id);
      expect(new Set(all).size).toBe(4);
      expect(all.sort()).toEqual([...tied, first.assetId].sort());
      expect(pageTwo.map(({ id }) => id).at(-1)).toBe(first.assetId);
    });

    it("never pages into another user's assets, whatever the cursor", async () => {
      const mine = await firstAsset();
      const theirs = await firstAsset();
      await setCreatedAt(theirs.assetId, "2026-01-01T00:00:00Z");
      const older = await library.listNewestForUser({
        before: {
          createdAtMs: Date.parse("2030-01-01T00:00:00Z"),
          id: uuidV7Schema.parse(createUuidV7()),
        },
        limit: 10,
        userId: mine.userId,
      });
      expect(older.map(({ id }) => id)).toEqual([mine.assetId]);
    });

    it("returns nothing after the oldest asset", async () => {
      const only = await firstAsset();
      const [record] = await library.listNewestForUser({
        limit: 1,
        userId: only.userId,
      });
      if (record === undefined) throw new Error("expected an asset");
      await expect(
        library.listNewestForUser({
          before: cursorAfter(record),
          limit: 10,
          userId: only.userId,
        }),
      ).resolves.toEqual([]);
    });
  });
});
