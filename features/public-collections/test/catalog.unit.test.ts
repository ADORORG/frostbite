import type { ApprovedVersionReader } from "@frostbite/collections";
import { describe, expect, it, vi } from "vitest";

import {
  createPublicCatalog,
  type PreviewSource,
} from "../src/application/catalog.ts";
import {
  chains,
  id,
  owner,
  previewsFor,
  summary,
  version,
} from "./support/fixtures.ts";

function setup(reader: Partial<ApprovedVersionReader> = {}) {
  const getMany = vi.fn<PreviewSource["getMany"]>(async () => []);
  const catalog = createPublicCatalog({
    chains,
    listLimit: 25,
    previews: { getMany },
    reader: {
      findApprovedVersion: async () => null,
      listApprovedCollections: async () => [],
      ...reader,
    },
  });
  return { catalog, getMany };
}

describe("public catalog index", () => {
  it("is empty when nothing is approved, and signs nothing", async () => {
    const { catalog, getMany } = setup();
    expect(await catalog.index()).toEqual([]);
    expect(getMany).not.toHaveBeenCalled();
  });

  it("asks for the configured number of collections", async () => {
    const listApprovedCollections = vi.fn(async () => []);
    await setup({ listApprovedCollections }).catalog.index();
    expect(listApprovedCollections).toHaveBeenCalledWith(25);
  });

  it("signs each cover as its own creator's asset, once, and presents the cards in order", async () => {
    const [first, second] = [
      summary({ name: "First" }),
      summary({ name: "Second", ownerUserId: id() }),
    ];
    const { catalog, getMany } = setup({
      listApprovedCollections: async () => [first, second],
    });
    const cards = await catalog.index();
    expect(cards.map(({ name }) => name)).toEqual(["First", "Second"]);
    expect(getMany.mock.calls.map(([who, ids]) => [who, ids])).toEqual([
      [first.ownerUserId, [first.coverAssetId]],
      [second.ownerUserId, [second.coverAssetId]],
    ]);
  });

  it("shows a collection without a cover without asking for any image", async () => {
    const bare = summary({ coverAssetId: null });
    const { catalog, getMany } = setup({
      listApprovedCollections: async () => [bare],
    });
    expect((await catalog.index())[0]?.cover).toBeNull();
    expect(getMany).not.toHaveBeenCalled();
  });
});

describe("public catalog detail", () => {
  it("is nothing when the collection has no approved version", async () => {
    const { catalog, getMany } = setup();
    expect(await catalog.detail(id())).toBeNull();
    expect(getMany).not.toHaveBeenCalled();
  });

  it("signs exactly the images frozen into the approved version, as its creator's assets", async () => {
    const approved = version();
    const { catalog, getMany } = setup({
      findApprovedVersion: async () => approved,
    });
    getMany.mockResolvedValue(previewsFor(approved));
    const page = await catalog.detail(approved.collectionId);
    expect(getMany).toHaveBeenCalledOnce();
    expect(getMany).toHaveBeenCalledWith(
      owner,
      approved.snapshot.assets.map(({ id: assetId }) => assetId),
    );
    expect(page?.cover?.src).toContain("storage.example.test");
  });

  it("asks for no images when the version froze none", async () => {
    const approved = version();
    const bare = {
      ...approved,
      snapshot: { ...approved.snapshot, assets: [] },
    };
    const { catalog, getMany } = setup({
      findApprovedVersion: async () => bare,
    });
    expect((await catalog.detail(approved.collectionId))?.cover).toBeNull();
    expect(getMany).not.toHaveBeenCalled();
  });
});
