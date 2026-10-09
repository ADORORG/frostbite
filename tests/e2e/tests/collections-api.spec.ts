import {
  collectionItemChangeSchema,
  collectionListResponseSchema,
} from "@ador/shared/collections";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { errorCode, origin, post } from "../src/upload-api.ts";
import { signIn } from "../src/upload-helpers.ts";
import {
  create,
  detailOf,
  draftBody,
  draftsPath,
  itemBody,
  itemsPath,
  readPath,
  uploadProcessed,
} from "./support/collection-helpers.ts";

// Collection drafts (W4-01) on real services: an approved creator builds a draft from images they
// uploaded, sees signed previews, and edits it under revision control. Every response is parsed with
// the shared contract. Desktop only, with its own user.
test.describe.configure({ mode: "serial", timeout: 180_000 });

test("an approved creator builds a draft with signed previews and edits it under revision control", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.collectionCreator);
  // One at a time: a creator may hold only a few unfinished upload intents at once.
  const cover = await uploadProcessed(
    page.request,
    baseURL,
    "cover-0000000000001",
    "collection-artwork",
  );
  const imageOne = await uploadProcessed(
    page.request,
    baseURL,
    "image-000000000001",
    "collection-item-artwork",
  );
  const imageTwo = await uploadProcessed(
    page.request,
    baseURL,
    "image-000000000002",
    "collection-item-artwork",
  );

  // Creating is idempotent, and a different request under one key is refused.
  const created = await create(
    page.request,
    baseURL,
    "create-00000000001",
    draftBody({ coverAssetId: cover }),
  );
  expect(created.ok()).toBe(true);
  const detail = await detailOf(created);
  const collectionId = detail.collection.id;
  const replay = await detailOf(
    await create(
      page.request,
      baseURL,
      "create-00000000001",
      draftBody({ coverAssetId: cover }),
    ),
  );
  expect(replay.collection.id).toBe(collectionId);
  const drift = await create(
    page.request,
    baseURL,
    "create-00000000001",
    draftBody({ coverAssetId: cover, name: "Other" }),
  );
  expect([drift.status(), await errorCode(drift)]).toEqual([409, "conflict"]);

  // The preview carries signed renditions that storage serves.
  const preview = detail.previews.find(({ id }) => id === cover);
  expect(preview?.derivativeAccess).toBe("available");
  const rendition = preview?.derivatives[0];
  if (rendition === undefined) throw new Error("expected a signed rendition");
  const fetched = await page.request.get(rendition.url);
  expect([fetched.status(), fetched.headers()["content-type"]]).toEqual([
    200,
    "image/webp",
  ]);

  // Items: an add is idempotent, positions follow order, and each change moves the revision.
  const add = (key: string, body: object) =>
    post(
      page.request,
      baseURL,
      itemsPath,
      { collectionId, item: body },
      { "idempotency-key": key },
    );
  const first = collectionItemChangeSchema.parse(
    await (await add("item-0000000000001", itemBody(imageOne))).json(),
  );
  const again = collectionItemChangeSchema.parse(
    await (await add("item-0000000000001", itemBody(imageOne))).json(),
  );
  expect([first.item.position, again.item.id, again.revision]).toEqual([
    1,
    first.item.id,
    first.revision,
  ]);
  const second = collectionItemChangeSchema.parse(
    await (await add("item-0000000000002", itemBody(imageTwo, "Two"))).json(),
  );
  expect([second.item.position, second.revision]).toEqual([
    2,
    first.revision + 1,
  ]);

  // The planned supply caps the items, and an image must be item artwork.
  const full = await add("item-0000000000003", itemBody(imageOne));
  expect([full.status(), await errorCode(full)]).toEqual([409, "conflict"]);
  const wrongPurpose = await post(
    page.request,
    baseURL,
    draftsPath,
    draftBody({ coverAssetId: imageOne }),
    { "idempotency-key": "wrong-0000000000001" },
  );
  expect([wrongPurpose.status(), await errorCode(wrongPurpose)]).toEqual([
    400,
    "invalid_request",
  ]);

  // A save must name the current revision; a stale one is refused and loses nothing.
  const save = (expectedRevision: number, overrides: object) =>
    page.request.put(draftsPath, {
      data: {
        collectionId,
        draft: draftBody({ coverAssetId: cover, ...overrides }),
        expectedRevision,
      },
      headers: { origin: origin(baseURL) },
    });
  const saved = await detailOf(
    await save(second.revision, { name: "Renamed" }),
  );
  expect([saved.collection.name, saved.collection.revision]).toEqual([
    "Renamed",
    second.revision + 1,
  ]);
  const stale = await save(second.revision, { name: "Stale" });
  expect([stale.status(), await errorCode(stale)]).toEqual([409, "conflict"]);
  const shrink = await save(saved.collection.revision, { plannedSupply: 1 });
  expect([shrink.status(), await errorCode(shrink)]).toEqual([
    400,
    "invalid_request",
  ]);

  // Updating and removing: removing twice is the same success, and the list reflects the result.
  const update = await page.request.put(itemsPath, {
    data: {
      collectionId,
      item: itemBody(imageTwo, "Renamed two"),
      itemId: second.item.id,
    },
    headers: { origin: origin(baseURL) },
  });
  expect(collectionItemChangeSchema.parse(await update.json()).item.name).toBe(
    "Renamed two",
  );
  const remove = () =>
    page.request.delete(itemsPath, {
      data: { collectionId, itemId: first.item.id },
      headers: { origin: origin(baseURL) },
    });
  const removed = await remove();
  expect(removed.ok()).toBe(true);
  expect((await remove()).ok()).toBe(true);
  const read = await detailOf(
    await post(page.request, baseURL, readPath, { collectionId }),
  );
  expect(read.items.map(({ name }) => name)).toEqual(["Renamed two"]);
  const list = collectionListResponseSchema.parse(
    await (await page.request.get(draftsPath)).json(),
  );
  expect(list.collections.map(({ id, itemCount }) => [id, itemCount])).toEqual([
    [collectionId, 1],
  ]);
});
