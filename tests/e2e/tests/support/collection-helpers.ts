import { createDecodablePng } from "@frostbite/test-kit/png";
import { collectionDetailSchema } from "@frostbite/shared/collections";
import { expect, type APIRequestContext } from "@playwright/test";

import {
  assetOf,
  assetsPath,
  completePath,
  createIntent,
  intentOf,
  get,
  libraryOf,
  post,
} from "../../src/upload-api.ts";
import { processingTimeout } from "../../src/upload-helpers.ts";

export const draftsPath = "/api/v1/collection-drafts";
export const itemsPath = `${draftsPath}/items`;
export const readPath = `${draftsPath}/read`;
export const chain = "bip122:00000008819873e925422c1ff0f99f7c";

export const draftBody = (overrides: object = {}) => ({
  bannerAssetId: null,
  coverAssetId: null,
  description: "A small collection",
  name: "First light",
  plannedSupply: 2,
  provenance: "Drawn by hand",
  targetChain: chain,
  ...overrides,
});
export const itemBody = (imageAssetId: string, name = "Item") => ({
  attributes: [{ trait: "Colour", value: "Blue" }],
  description: "",
  imageAssetId,
  name,
});

export async function uploadProcessed(
  request: APIRequestContext,
  baseURL: string | undefined,
  key: string,
  purpose: string,
  fileName?: string,
): Promise<string> {
  const bytes = createDecodablePng(16, 16);
  const { intent, upload } = await intentOf(
    await createIntent(request, baseURL, key, {
      byteLength: bytes.length,
      contentType: "image/png",
      fileName,
      purpose,
    }),
  );
  expect(
    (
      await request.put(upload.url, { data: bytes, headers: upload.headers })
    ).ok(),
  ).toBe(true);
  const asset = await assetOf(
    await post(request, baseURL, completePath, { intentId: intent.id }),
  );
  await expect
    .poll(
      async () =>
        (await libraryOf(await request.get(assetsPath))).assets.find(
          ({ id }) => id === asset.id,
        )?.processingState,
      { timeout: processingTimeout },
    )
    .toBe("processed");
  return asset.id;
}

export const create = (
  request: APIRequestContext,
  baseURL: string | undefined,
  key: string,
  body: object,
) => post(request, baseURL, draftsPath, body, { "idempotency-key": key });
// The creator's own draft with its items, read by id.
export const readDraft = (request: APIRequestContext, collectionId: string) =>
  get(request, readPath, { collectionId });
// A response body is `unknown` (untrusted) until the shared contract accepts it, as in `upload-api.ts`.
export const detailOf = async (response: { json(): Promise<unknown> }) =>
  collectionDetailSchema.parse(await response.json());

// A creator's collection that satisfies every submission requirement, built through the API: a cover
// image, a description, and one item with its own image. Returns what a spec needs to find it again.
export async function createReadyCollection(
  request: APIRequestContext,
  baseURL: string | undefined,
  name: string,
  prefix: string,
) {
  const cover = await uploadProcessed(
    request,
    baseURL,
    `${prefix}-cover-000001`,
    "collection-artwork",
  );
  const image = await uploadProcessed(
    request,
    baseURL,
    `${prefix}-image-000001`,
    "collection-item-artwork",
  );
  const created = await detailOf(
    await create(
      request,
      baseURL,
      `${prefix}-create-0001`,
      draftBody({
        coverAssetId: cover,
        description: "A small ready collection",
        name,
        plannedSupply: 1,
      }),
    ),
  );
  const added = await post(
    request,
    baseURL,
    itemsPath,
    { collectionId: created.collection.id, item: itemBody(image, "Dawn") },
    { "idempotency-key": `${prefix}-item-000001` },
  );
  expect(added.ok()).toBe(true);
  return { id: created.collection.id, name };
}
