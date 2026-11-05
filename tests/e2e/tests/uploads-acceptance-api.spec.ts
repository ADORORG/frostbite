import { createDecodablePng } from "@frostbite/test-kit/png";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";
import {
  assetOf,
  assetsPath,
  completePath,
  createIntent,
  errorCode,
  get,
  intentOf,
  intentsPath,
  libraryOf,
  olderAssetsPath,
  origin,
  post,
} from "../src/upload-api.ts";
import { processingTimeout, signIn } from "../src/upload-helpers.ts";

// The Week 3 acceptance gate, API half, on real services: anonymous callers, missing origins,
// unsupported types, oversized declarations, and oversized bodies are refused; intent creation,
// completion, and processing are idempotent and retryable; and another user cannot reach an upload. Every
// response is parsed with the shared contract. Desktop only; each concern has its own user.
test.describe.configure({ mode: "serial", timeout: 150_000 });

test("the API refuses anonymous callers, missing origins, unsupported types, and oversized declarations", async ({
  baseURL,
  browser,
  page,
}) => {
  const anonymous = await browser.newContext({ baseURL });
  const refused = await createIntent(
    anonymous.request,
    baseURL,
    "anon-0000000001",
    {
      byteLength: 100,
      contentType: "image/png",
    },
  );
  expect(refused.status()).toBe(401);
  await anonymous.close();

  await signIn(page, baseURL, creatorE2EFixtures.acceptanceApiUploader);
  const noOrigin = await page.request.post(intentsPath, {
    data: {
      byteLength: 100,
      contentType: "image/png",
      purpose: "collection-artwork",
    },
    headers: { "idempotency-key": "no-origin-00000001" },
  });
  expect(noOrigin.status()).toBe(403);

  const gif = await createIntent(page.request, baseURL, "gif-00000000000001", {
    byteLength: 100,
    contentType: "image/gif",
  });
  expect([gif.status(), await errorCode(gif)]).toEqual([
    400,
    "invalid_request",
  ]);

  const tooLarge = await createIntent(
    page.request,
    baseURL,
    "big-0000000000001",
    {
      byteLength: 5_000_001,
      contentType: "image/png",
      purpose: "creator-avatar",
    },
  );
  expect([tooLarge.status(), await errorCode(tooLarge)]).toEqual([
    400,
    "invalid_request",
  ]);
});

test("storage refuses an upload longer than declared, and completing nothing is a conflict", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.acceptanceApiUploader);
  const created = await createIntent(
    page.request,
    baseURL,
    "short-0000000001",
    {
      byteLength: 10,
      contentType: "image/png",
    },
  );
  expect(created.ok()).toBe(true);
  const { intent, upload } = await intentOf(created);
  const oversized = await page.request.put(upload.url, {
    data: Buffer.alloc(20),
    headers: { "content-type": "image/png" },
  });
  expect(oversized.ok()).toBe(false);
  const incomplete = await post(page.request, baseURL, completePath, {
    intentId: intent.id,
  });
  expect([incomplete.status(), await errorCode(incomplete)]).toEqual([
    409,
    "conflict",
  ]);
});

test("intent creation, completion, and processing are idempotent, and another user cannot reach the upload", async ({
  baseURL,
  browser,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.acceptanceApiUploader);
  const bytes = createDecodablePng(16, 16);
  const body = { byteLength: bytes.length, contentType: "image/png" };
  const key = "replay-0000000001";
  const first = await createIntent(page.request, baseURL, key, body);
  expect(first.ok()).toBe(true);
  const { intent, upload } = await intentOf(first);
  const replay = await createIntent(page.request, baseURL, key, body);
  expect((await intentOf(replay)).intent.id).toBe(intent.id);
  const drift = await createIntent(page.request, baseURL, key, {
    ...body,
    byteLength: bytes.length + 1,
  });
  expect([drift.status(), await errorCode(drift)]).toEqual([409, "conflict"]);

  const stored = await page.request.put(upload.url, {
    data: bytes,
    headers: upload.headers,
  });
  expect(stored.ok()).toBe(true);

  // The owner completes it.
  const completed = await post(page.request, baseURL, completePath, {
    intentId: intent.id,
  });
  expect(completed.ok()).toBe(true);
  const asset = await assetOf(completed);

  // Another signed-in user gets "not found", exactly as for an intent that does not exist, and sees
  // none of the owner's assets, even now that the owner's asset exists.
  const other = await browser.newContext({ baseURL });
  await useE2ESession(
    other,
    origin(baseURL),
    creatorE2EFixtures.acceptanceApiOther.sessionToken,
  );
  const foreign = await post(other.request, baseURL, completePath, {
    intentId: intent.id,
  });
  expect([foreign.status(), await errorCode(foreign)]).toEqual([
    404,
    "not_found",
  ]);
  expect(await libraryOf(await other.request.get(assetsPath))).toEqual({
    assets: [],
    nextCursor: null,
  });
  await other.close();

  // Completing again (a retry) returns the same asset.
  const retried = await post(page.request, baseURL, completePath, {
    intentId: intent.id,
  });
  expect((await assetOf(retried)).id).toBe(asset.id);

  // Processing finishes once, and completing after it still names the same asset.
  await expect
    .poll(
      async () =>
        (await libraryOf(await page.request.get(assetsPath))).assets.map(
          ({ id, processingState }) => [id, processingState],
        ),
      { timeout: processingTimeout },
    )
    .toEqual([[asset.id, "processed"]]);
  const afterwards = await assetOf(
    await post(page.request, baseURL, completePath, { intentId: intent.id }),
  );
  expect([afterwards.id, afterwards.processingState]).toEqual([
    asset.id,
    "processed",
  ]);
});

test("paging back through the library needs a session and a well-formed cursor, and reaches only the caller's own list", async ({
  baseURL,
  browser,
  page,
}) => {
  const cursor = "1760000000000.0198a000-0000-7000-8000-000000000001";
  const anonymous = await browser.newContext({ baseURL });
  const refused = await get(anonymous.request, olderAssetsPath, {
    before: cursor,
  });
  expect(refused.status()).toBe(401);
  await anonymous.close();

  await signIn(page, baseURL, creatorE2EFixtures.acceptanceApiOther);
  // The page after a cursor is a read: a GET with the cursor in the query. The old POST route is gone.
  expect(
    (
      await post(page.request, baseURL, olderAssetsPath, { before: cursor })
    ).status(),
  ).toBe(405);
  const malformed: Record<string, string>[] = [
    {},
    { before: "yesterday" },
    { before: cursor, userId: "x" },
  ];
  for (const bad of malformed) {
    const response = await get(page.request, olderAssetsPath, bad);
    expect(response.status()).toBe(400);
    expect(await errorCode(response)).toBe("invalid_request");
  }
  // A cursor for the far future still lists only this person's own assets, of which a fresh account has none.
  const page2 = await get(page.request, olderAssetsPath, {
    before: "9999999999999.0198a000-0000-7000-8000-000000000001",
  });
  expect(page2.status()).toBe(200);
  expect(await libraryOf(page2)).toEqual({ assets: [], nextCursor: null });
});
