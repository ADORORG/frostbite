import type { ApprovedVersionReader } from "@frostbite/collections";
import { describe, expect, it, vi } from "vitest";

import {
  createPublicCatalog,
  type PreviewSource,
} from "../src/application/catalog.ts";
import {
  collectionPage,
  collectionSitemapPaths,
  collectionsIndexPage,
} from "../src/metadata.ts";
import { chains, id, summary, version } from "./support/fixtures.ts";

function catalogOf(reader: Partial<ApprovedVersionReader>) {
  const catalog = createPublicCatalog({
    chains,
    listLimit: 25,
    previews: { getMany: vi.fn<PreviewSource["getMany"]>(async () => []) },
    reader: {
      findApprovedVersion: async () => null,
      listApprovedCollections: async () => [],
      ...reader,
    },
  });
  return async () => catalog;
}

const unreadable = async () => {
  throw new Error("The database is down.");
};

describe("the collections page's metadata", () => {
  it("is shared when something is approved", async () => {
    const get = catalogOf({ listApprovedCollections: async () => [summary()] });
    expect(await collectionsIndexPage(get)).toMatchObject({
      kind: "shared",
      title: "Collections",
    });
  });

  it("is private when nothing is approved, or the catalog cannot be read", async () => {
    expect(await collectionsIndexPage(catalogOf({}))).toEqual({
      kind: "private",
    });
    expect(await collectionsIndexPage(unreadable)).toEqual({ kind: "private" });
  });
});

describe("an approved collection's metadata", () => {
  const approved = version();
  const get = catalogOf({
    findApprovedVersion: async (collectionId) =>
      collectionId === approved.collectionId ? approved : null,
  });

  it("is the collection's own name and description", async () => {
    expect(await collectionPage(get, approved.collectionId)).toEqual({
      description: "A small collection of hand-drawn lights.",
      kind: "shared",
      title: "First light",
    });
  });

  it("names the chain when the collection has no description", async () => {
    const bare = {
      ...approved,
      snapshot: {
        ...approved.snapshot,
        collection: { ...approved.snapshot.collection, description: "" },
      },
    };
    const page = await collectionPage(
      catalogOf({ findApprovedVersion: async () => bare }),
      approved.collectionId,
    );
    expect(page.kind === "shared" && page.description).toBe(
      "First light, a collection on Bitcoin signet.",
    );
  });

  it("reveals nothing about a collection that is not approved, not valid, or unreadable", async () => {
    expect(await collectionPage(get, id())).toEqual({ kind: "private" });
    expect(await collectionPage(get, "not-an-id")).toEqual({ kind: "private" });
    expect(await collectionPage(get, undefined)).toEqual({ kind: "private" });
    expect(await collectionPage(unreadable, approved.collectionId)).toEqual({
      kind: "private",
    });
  });
});

describe("the collections in the sitemap", () => {
  it("are the collections page and each approved collection", async () => {
    const first = summary();
    const second = summary();
    const paths = await collectionSitemapPaths(
      catalogOf({ listApprovedCollections: async () => [first, second] }),
    );
    expect(paths).toEqual([
      "/collections",
      `/collections/${first.collectionId}`,
      `/collections/${second.collectionId}`,
    ]);
  });

  it("are none when nothing is approved or the catalog cannot be read", async () => {
    expect(await collectionSitemapPaths(catalogOf({}))).toEqual([]);
    expect(await collectionSitemapPaths(unreadable)).toEqual([]);
  });
});
