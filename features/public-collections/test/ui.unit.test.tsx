import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  presentCard,
  presentCollection,
} from "../src/application/public-model.ts";
import { CollectionDetail } from "../src/ui/collection-detail.tsx";
import { CollectionIndex } from "../src/ui/collection-index.tsx";
import {
  CatalogUnavailable,
  CollectionNotPublished,
  NoCollections,
} from "../src/ui/states.tsx";
import { chains, previewsFor, summary, version } from "./support/fixtures.ts";

const navigation = [
  { access: { kind: "public" }, href: "/collections", label: "Collections" },
] as const;

describe("collection index", () => {
  it("lists each approved collection with a link that names it, its chain, and its counts", () => {
    const row = summary({ name: "Second light" });
    const markup = renderToStaticMarkup(
      <CollectionIndex
        cards={[presentCard(row, [], chains)]}
        navigation={navigation}
      />,
    );
    expect(markup).toContain('aria-label="Approved collections"');
    expect(markup).toContain(`href="/collections/${row.collectionId}"`);
    expect(markup).toContain("View Second light");
    expect(markup).toContain("Bitcoin signet");
    expect(markup).toContain("1 of 2 items");
    expect(markup).toContain("Preview unavailable");
  });

  it("says approval is not a launch, and shows the cover when it is available", () => {
    const row = summary();
    const markup = renderToStaticMarkup(
      <CollectionIndex
        cards={[
          presentCard(
            row,
            previewsFor(
              version({
                snapshot: {
                  ...version().snapshot,
                  assets: [
                    {
                      contentSha256: "b".repeat(64),
                      id: row.coverAssetId ?? "",
                      purpose: "collection-artwork",
                    },
                  ],
                },
              }),
            ),
            chains,
          ),
        ]}
        navigation={navigation}
      />,
    );
    expect(markup).toContain("Approved by review");
    expect(markup).toContain(
      "does not mean they are minted, listed, or on sale",
    );
    expect(markup).toContain("<img");
  });
});

describe("collection detail", () => {
  it("shows the approved version in full, with the approval stated honestly", () => {
    const approved = version();
    const markup = renderToStaticMarkup(
      <CollectionDetail
        collection={presentCollection(approved, previewsFor(approved), chains)}
        navigation={navigation}
      />,
    );
    for (const text of [
      "Approved by review. Not yet minted.",
      "First light",
      "Bitcoin signet",
      "A small collection of hand-drawn lights.",
      "Drawn by hand",
      "Items (1)",
      "1. Dawn",
      "The first light",
      "Colour: Blue",
      "Banner of First light",
    ])
      expect(markup).toContain(text);
    expect(markup).toContain('aria-label="Items in this collection"');
    expect(markup.match(/<img/gu)).toHaveLength(3);
  });

  it("leaves out provenance and the banner when there are none, and shows placeholders for missing previews", () => {
    const approved = version();
    const bare = presentCollection(
      {
        ...approved,
        snapshot: {
          ...approved.snapshot,
          collection: {
            ...approved.snapshot.collection,
            bannerAssetId: null,
            provenance: "",
          },
        },
      },
      [],
      chains,
    );
    const markup = renderToStaticMarkup(
      <CollectionDetail collection={bare} navigation={navigation} />,
    );
    expect(markup).not.toContain("Provenance");
    expect(markup).not.toContain("Banner of");
    expect(markup).toContain("Preview unavailable");
    expect(markup).not.toContain("<img");
  });

  it("leaves an item's description out when it has none", () => {
    const approved = version();
    const first = approved.snapshot.items[0];
    if (first === undefined) throw new Error("fixture has an item");
    const bare = presentCollection(
      {
        ...approved,
        snapshot: {
          ...approved.snapshot,
          items: [{ ...first, description: "" }],
        },
      },
      [],
      chains,
    );
    expect(
      renderToStaticMarkup(
        <CollectionDetail collection={bare} navigation={navigation} />,
      ),
    ).not.toContain("The first light");
  });
});

describe("states", () => {
  it("says the catalog is empty, and that drafts are never shown", () => {
    const markup = renderToStaticMarkup(
      <NoCollections navigation={navigation} />,
    );
    expect(markup).toContain("Catalog empty");
    expect(markup).toContain("No collections online");
    expect(markup).toContain("never shown here");
  });

  it("says the catalog could not be read, rather than looking empty", () => {
    const markup = renderToStaticMarkup(
      <CatalogUnavailable navigation={navigation} />,
    );
    expect(markup).toContain("Catalog unavailable");
    expect(markup).not.toContain("Catalog empty");
    expect(markup).toContain("Nothing has been removed");
  });

  it("reports an invalid address and an unpublished one in different words, never revealing which exist", () => {
    const invalid = renderToStaticMarkup(
      <CollectionNotPublished navigation={navigation} valid={false} />,
    );
    const missing = renderToStaticMarkup(
      <CollectionNotPublished navigation={navigation} valid />,
    );
    expect(invalid).toContain("Invalid identifier");
    expect(missing).toContain("Record not published");
    expect(missing).toContain("No approved collection matches this address.");
  });
});
