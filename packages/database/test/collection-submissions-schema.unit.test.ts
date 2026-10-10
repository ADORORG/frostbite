import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  authUsers,
  collectionReviewEvents,
  collectionSubmissions,
  collections,
  type CollectionSubmissionRow,
} from "../src/index.ts";

const foreignTables = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).foreignKeys.map((key) =>
    getTableName(key.reference().foreignTable),
  );
const indexes = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).indexes.map(({ config }) => config);
const checkNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).checks.map(({ name }) => name);

describe("collection submission schema", () => {
  it("belongs to a collection and an owner and never cascades deletes", () => {
    expect(foreignTables(collectionSubmissions)).toEqual([
      getTableName(collections),
      getTableName(authUsers),
    ]);
    for (const key of getTableConfig(collectionSubmissions).foreignKeys)
      expect(key.onDelete).toBe("restrict");
  });

  it("allows one sequence per collection and at most one live submission", () => {
    const byName = new Map(
      indexes(collectionSubmissions).map((index) => [index.name, index]),
    );
    expect(
      byName.get("collection_submissions_collection_sequence_unique")?.unique,
    ).toBe(true);
    const live = byName.get("collection_submissions_one_live_per_collection");
    expect(live?.unique).toBe(true);
    expect(live?.where).toBeDefined();
  });

  it("states the stored invariants as checks", () => {
    expect(checkNames(collectionSubmissions)).toEqual(
      expect.arrayContaining([
        "collection_submissions_sequence_positive",
        "collection_submissions_revision_positive",
        "collection_submissions_schema_version_supported",
        "collection_submissions_hash_sha256",
      ]),
    );
  });

  it("infers persistence fields from the Drizzle table", () => {
    expectTypeOf<CollectionSubmissionRow["sequence"]>().toEqualTypeOf<number>();
    expectTypeOf<CollectionSubmissionRow["snapshot"]["items"]>().toBeArray();
  });
});

describe("collection review event schema", () => {
  it("records who acted, makes an idempotency key unique, and states its invariants", () => {
    expect(foreignTables(collectionReviewEvents)).toEqual([
      getTableName(collectionSubmissions),
      getTableName(authUsers),
    ]);
    expect(
      indexes(collectionReviewEvents).find(
        ({ name }) => name === "collection_review_events_idempotency_unique",
      )?.unique,
    ).toBe(true);
    expect(checkNames(collectionReviewEvents)).toEqual(
      expect.arrayContaining([
        "collection_review_events_reason_code_valid",
        "collection_review_events_policy_version_nonempty",
        "collection_review_events_fingerprint_sha256",
        "collection_review_events_previous_state_coherent",
      ]),
    );
  });
});
