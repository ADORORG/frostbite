import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  assets,
  authUsers,
  collectionItems,
  collections,
  type Collection,
  type CollectionItemRow,
} from "../src/index.ts";

const foreignTables = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).foreignKeys.map((key) =>
    getTableName(key.reference().foreignTable),
  );
const indexNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).indexes.map(({ config }) => config.name);
const checkNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).checks.map(({ name }) => name);

describe("collection schema", () => {
  it("is owned by a user and references only the creator's assets, never cascading deletes", () => {
    expect(foreignTables(collections)).toEqual([
      getTableName(authUsers),
      getTableName(assets),
      getTableName(assets),
    ]);
    for (const key of getTableConfig(collections).foreignKeys)
      expect(key.onDelete).toBe("restrict");
  });

  it("owns per-creator idempotency, listing, and the stored invariants", () => {
    expect(indexNames(collections)).toEqual(
      expect.arrayContaining([
        "collections_owner_idempotency_unique",
        "collections_owner_updated_idx",
      ]),
    );
    expect(checkNames(collections)).toEqual(
      expect.arrayContaining([
        "collections_revision_positive",
        "collections_name_valid",
        "collections_text_bounded",
        "collections_planned_supply_bounded",
        "collections_chain_id_caip2",
        "collections_fingerprint_sha256",
      ]),
    );
  });

  it("infers persistence fields from the Drizzle table", () => {
    expectTypeOf<Collection["revision"]>().toEqualTypeOf<number>();
    expectTypeOf<Collection["coverAssetId"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Collection["createdAt"]>().toEqualTypeOf<Date>();
  });
});

describe("collection item schema", () => {
  it("belongs to a collection and one of the creator's assets, with ordered positions and idempotency", () => {
    expect(foreignTables(collectionItems)).toEqual([
      getTableName(collections),
      getTableName(assets),
    ]);
    expect(indexNames(collectionItems)).toEqual(
      expect.arrayContaining([
        "collection_items_collection_position_unique",
        "collection_items_collection_idempotency_unique",
      ]),
    );
    expect(checkNames(collectionItems)).toEqual(
      expect.arrayContaining([
        "collection_items_position_positive",
        "collection_items_name_valid",
        "collection_items_description_bounded",
        "collection_items_attributes_bounded",
        "collection_items_fingerprint_sha256",
      ]),
    );
  });

  it("infers persistence fields from the Drizzle table", () => {
    expectTypeOf<CollectionItemRow["position"]>().toEqualTypeOf<number>();
    expectTypeOf<CollectionItemRow["attributes"][number]>().toEqualTypeOf<{
      trait: string;
      value: string;
    }>();
  });
});
