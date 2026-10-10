import type {
  Collection,
  CollectionItemRow,
} from "@ador/database/schema/collections";
import { requestFingerprint } from "@ador/shared/http";
import { describe, expect, it } from "vitest";

import { buildSnapshot } from "../src/adapters/snapshot-builder.ts";
import { newId, signet } from "./support/fixtures.ts";

const at = new Date("2026-10-10T12:00:00.000Z");
const owner = newId();
const collection: Collection = {
  bannerAssetId: null,
  chainId: signet,
  coverAssetId: null,
  createdAt: at,
  description: "About",
  id: newId(),
  idempotencyKey: "request-key-00000001",
  name: "First light",
  ownerUserId: owner,
  plannedSupply: 1,
  provenance: "",
  requestFingerprint: "a".repeat(64),
  revision: 1,
  updatedAt: at,
};
const item: CollectionItemRow = {
  attributes: [{ trait: "Colour", value: "Blue" }],
  collectionId: collection.id,
  createdAt: at,
  description: "",
  id: newId(),
  idempotencyKey: "request-key-00000002",
  imageAssetId: newId(),
  name: "Item",
  position: 1,
  requestFingerprint: "b".repeat(64),
  updatedAt: at,
};
const asset = (
  purpose: "collection-artwork" | "collection-item-artwork",
  sha: string,
) => ({
  contentSha256: sha.repeat(64),
  id: newId(),
  purpose,
});

describe("building a snapshot", () => {
  const assets = [
    asset("collection-item-artwork", "c"),
    asset("collection-artwork", "b"),
    asset("collection-item-artwork", "a"),
  ];

  it("yields the same snapshot and hash for the same assets however they arrive", () => {
    const forward = buildSnapshot({ assets, collection, items: [item] });
    const reversed = buildSnapshot({
      assets: [...assets].reverse(),
      collection,
      items: [item],
    });
    expect(reversed).toEqual(forward);
    expect(requestFingerprint(reversed)).toBe(requestFingerprint(forward));
  });

  it("lists assets by purpose and then id", () => {
    const keys = buildSnapshot({
      assets,
      collection,
      items: [item],
    }).assets.map(({ id, purpose }) => `${purpose}:${id}`);
    expect(keys).toEqual([...keys].sort());
  });

  it("carries only the draft's own fields and each item's record, never ids of the row's owner or keys", () => {
    const snapshot = buildSnapshot({ assets: [], collection, items: [item] });
    expect(Object.keys(snapshot.collection).sort()).toEqual([
      "bannerAssetId",
      "coverAssetId",
      "description",
      "name",
      "plannedSupply",
      "provenance",
      "targetChain",
    ]);
    expect(JSON.stringify(snapshot)).not.toContain(owner);
    expect(JSON.stringify(snapshot)).not.toContain("request-key");
    expect(snapshot.items[0]).toMatchObject({ name: "Item", position: 1 });
  });

  it("refuses to freeze something the shared schema would not accept", () => {
    expect(() =>
      buildSnapshot({
        assets: [
          { ...asset("collection-artwork", "a"), contentSha256: "not-a-hash" },
        ],
        collection,
        items: [],
      }),
    ).toThrow();
  });
});
