import { collectionListResponseSchema } from "@frostbite/shared/collections";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";
import { errorCode, origin, post } from "../src/upload-api.ts";
import { signIn } from "../src/upload-helpers.ts";
import {
  create,
  detailOf,
  draftBody,
  draftsPath,
  itemBody,
  itemsPath,
  readDraft,
  uploadProcessed,
} from "./support/collection-helpers.ts";

// Who may and may not touch collection drafts, on real services: anonymous callers and creators who
// were never approved are refused, and another approved creator reaches none of a creator's drafts or
// images. Desktop only, with its own users.
test.describe.configure({ mode: "serial", timeout: 180_000 });

test("the API refuses anonymous callers and creators who were never approved", async ({
  baseURL,
  browser,
  page,
}) => {
  const anonymous = await browser.newContext({ baseURL });
  expect((await anonymous.request.get(draftsPath)).status()).toBe(401);
  await anonymous.close();

  await signIn(page, baseURL, creatorE2EFixtures.collectionUnapproved);
  const refused = await create(
    page.request,
    baseURL,
    "unapproved-0000001",
    draftBody(),
  );
  expect([refused.status(), await errorCode(refused)]).toEqual([
    403,
    "forbidden",
  ]);
  const none = collectionListResponseSchema.parse(
    await (await page.request.get(draftsPath)).json(),
  );
  expect(none.collections).toEqual([]);
});

test("another approved creator cannot read, change, or build on a creator's draft or images", async ({
  baseURL,
  browser,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.collectionAccessOwner);
  const image = await uploadProcessed(
    page.request,
    baseURL,
    "image-000000000009",
    "collection-item-artwork",
  );
  const cover = await uploadProcessed(
    page.request,
    baseURL,
    "cover-0000000000009",
    "collection-artwork",
  );
  const created = await detailOf(
    await create(
      page.request,
      baseURL,
      "owner-draft-000001",
      draftBody({ coverAssetId: cover }),
    ),
  );
  const draftId = created.collection.id;

  const other = await browser.newContext({ baseURL });
  await useE2ESession(
    other,
    origin(baseURL),
    creatorE2EFixtures.collectionOtherCreator.sessionToken,
  );
  const read = await readDraft(other.request, draftId);
  expect([read.status(), await errorCode(read)]).toEqual([404, "not_found"]);
  const add = await post(
    other.request,
    baseURL,
    itemsPath,
    { collectionId: draftId, item: itemBody(image) },
    { "idempotency-key": "intrusion-00000001" },
  );
  expect([add.status(), await errorCode(add)]).toEqual([404, "not_found"]);
  expect(
    collectionListResponseSchema.parse(
      await (await other.request.get(draftsPath)).json(),
    ).collections,
  ).toEqual([]);
  // Their own draft may not reference the owner's image: it is reported like a missing one.
  const borrowed = await create(
    other.request,
    baseURL,
    "borrow-00000000001",
    draftBody({ coverAssetId: cover }),
  );
  expect([borrowed.status(), await errorCode(borrowed)]).toEqual([
    400,
    "invalid_request",
  ]);
  await other.close();
});
