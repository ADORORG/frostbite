import { createDecodablePng } from "@ador/test-kit/png";
import { collectionDetailSchema } from "@ador/shared/collections";
import { expect, type APIRequestContext } from "@playwright/test";

import {
  assetOf,
  assetsPath,
  completePath,
  createIntent,
  intentOf,
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
): Promise<string> {
  const bytes = createDecodablePng(16, 16);
  const { intent, upload } = await intentOf(
    await createIntent(request, baseURL, key, {
      byteLength: bytes.length,
      contentType: "image/png",
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
// A response body is `unknown` (untrusted) until the shared contract accepts it, as in `upload-api.ts`.
export const detailOf = async (response: { json(): Promise<unknown> }) =>
  collectionDetailSchema.parse(await response.json());
