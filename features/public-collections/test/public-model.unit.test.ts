import { libraryAssetFixture } from "@ador/test-kit/library-asset";
import { describe, expect, it } from "vitest";

import {
  chainLabel,
  imageOf,
  presentCard,
  presentCollection,
} from "../src/application/public-model.ts";
import {
  chains,
  id,
  previewsFor,
  signet,
  summary,
  version,
} from "./support/fixtures.ts";

describe("chain label", () => {
  it("is the configured display name, or the identifier when the chain is not configured", () => {
    expect(chainLabel(chains, signet)).toBe("Bitcoin signet");
    expect(chainLabel(chains, "eip155:1")).toBe("eip155:1");
  });
});

describe("image of an asset", () => {
  it("prefers the larger preview rendition and falls back to the thumbnail", () => {
    const assetId = id();
    const both = libraryAssetFixture("collection-artwork", assetId, {
      derivatives: [
        {
          contentType: "image/webp",
          expiresAt: "2099-01-01T00:00:00.000Z",
          heightPixels: 8,
          kind: "thumbnail",
          url: "https://s.example.test/t.webp",
          widthPixels: 8,
        },
        {
          contentType: "image/webp",
          expiresAt: "2099-01-01T00:00:00.000Z",
          heightPixels: 64,
          kind: "preview",
          url: "https://s.example.test/p.webp",
          widthPixels: 64,
        },
      ],
    });
    expect(imageOf([both], assetId, "Alt")).toEqual({
      alt: "Alt",
      height: 64,
      src: "https://s.example.test/p.webp",
      width: 64,
    });
    const thumbnailOnly = libraryAssetFixture("collection-artwork", assetId);
    expect(imageOf([thumbnailOnly], assetId, "Alt")?.height).toBe(8);
  });

  it("is nothing when there is no asset, no id, or no rendition, so a page shows a placeholder", () => {
    const assetId = id();
    expect(imageOf([], assetId, "Alt")).toBeNull();
    expect(
      imageOf(
        [libraryAssetFixture("collection-artwork", assetId)],
        null,
        "Alt",
      ),
    ).toBeNull();
    expect(
      imageOf(
        [
          libraryAssetFixture("collection-artwork", assetId, {
            derivatives: [],
          }),
        ],
        assetId,
        "Alt",
      ),
    ).toBeNull();
  });
});

describe("presenting an approved collection to the public", () => {
  it("shows a card with the chain's name, the counts, and the cover, and nothing about the creator", () => {
    const row = summary();
    const cover = libraryAssetFixture(
      "collection-artwork",
      row.coverAssetId ?? "",
    );
    const card = presentCard(row, [cover], chains);
    expect(card).toMatchObject({
      chainLabel: "Bitcoin signet",
      id: row.collectionId,
      itemCount: 1,
      name: "First light",
      plannedSupply: 2,
    });
    expect(card.cover?.alt).toBe("Cover image for First light");
    expect(JSON.stringify(card)).not.toContain(row.ownerUserId);
    expect(Object.keys(card).sort()).toEqual([
      "chainLabel",
      "cover",
      "description",
      "id",
      "itemCount",
      "name",
      "plannedSupply",
    ]);
  });

  it("shows a card without a cover as having none", () => {
    expect(
      presentCard(summary({ coverAssetId: null }), [], chains).cover,
    ).toBeNull();
  });

  it("shows the frozen version in full: details, images, items with traits, and nothing private", () => {
    const approved = version();
    const page = presentCollection(approved, previewsFor(approved), chains);
    expect(page).toMatchObject({
      chainLabel: "Bitcoin signet",
      description: "A small collection of hand-drawn lights.",
      id: approved.collectionId,
      name: "First light",
      plannedSupply: 2,
      provenance: "Drawn by hand",
    });
    expect(page.cover?.alt).toBe("Cover image for First light");
    expect(page.banner?.alt).toBe("Banner image for First light");
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      attributes: [{ trait: "Colour", value: "Blue" }],
      description: "The first light",
      name: "Dawn",
      position: 1,
    });
    expect(page.items[0]?.image?.alt).toBe("1. Dawn");
    const text = JSON.stringify(page);
    for (const secret of [
      approved.ownerUserId,
      approved.submissionId,
      approved.payloadHash,
      "contentSha256",
    ])
      expect(text).not.toContain(secret);
    expect(Object.keys(page).sort()).toEqual([
      "banner",
      "chainLabel",
      "cover",
      "description",
      "id",
      "items",
      "name",
      "plannedSupply",
      "provenance",
    ]);
  });

  it("leaves out images that are not available, rather than failing", () => {
    const approved = version();
    const page = presentCollection(approved, [], chains);
    expect([page.cover, page.banner, page.items[0]?.image]).toEqual([
      null,
      null,
      null,
    ]);
  });
});
