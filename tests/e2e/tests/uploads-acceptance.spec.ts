import { createJpeg, createWebp } from "@ador/test-kit/images";
import { createDecodablePng, createUndecodablePng } from "@ador/test-kit/png";
import { uploadsNewPath, uploadsStudioPath } from "@ador/shared/uploads";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { origin } from "../src/upload-api.ts";
import {
  chooseImage,
  processingTimeout,
  signIn,
} from "../src/upload-helpers.ts";

// The Week 3 acceptance gate, browser half, on real services (Postgres, S3-compatible storage, the
// worker, a signed Inngest runtime): valid formats upload straight to storage and are processed, and
// mismatched content and oversized dimensions are refused with a plain reason. The API half is in
// `uploads-acceptance-api.spec.ts`. Desktop only, like the other real-service specs; each concern has
// its own user so sessions and quotas never mix.
test.describe.configure({ mode: "serial", timeout: 150_000 });

test("valid PNG, JPEG, and WebP uploads go straight to storage and are processed", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.acceptanceFormatUploader);
  const requests: { contentType: string; method: string; origin: string }[] =
    [];
  page.on("request", (request) =>
    requests.push({
      contentType: request.headers()["content-type"] ?? "",
      method: request.method(),
      origin: new URL(request.url()).origin,
    }),
  );
  await page.goto(uploadsNewPath);
  const formats = [
    ["art.png", "image/png", createDecodablePng(64, 48)],
    ["photo.jpg", "image/jpeg", createJpeg()],
    ["sticker.webp", "image/webp", createWebp()],
  ] as const;
  for (const [name, mimeType, buffer] of formats) {
    await chooseImage(page, name, mimeType, buffer);
    await expect(page.getByText("Upload processed")).toBeVisible({
      timeout: processingTimeout,
    });
    await page.getByRole("button", { name: "Upload another" }).click();
  }
  await page
    .getByRole("link", { name: "Uploads", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("img", { name: "Collection artwork thumbnail" }),
  ).toHaveCount(formats.length, { timeout: processingTimeout });
  // Each upload is one PUT to the storage origin carrying its own type; the application origin never
  // receives image bytes.
  const puts = requests.filter(({ method }) => method === "PUT");
  expect(puts.map(({ contentType }) => contentType)).toEqual(
    formats.map(([, mimeType]) => mimeType),
  );
  expect(puts.every((put) => put.origin !== origin(baseURL))).toBe(true);
  expect(
    requests.filter(
      (request) =>
        request.origin === origin(baseURL) &&
        request.contentType.startsWith("image/"),
    ),
  ).toEqual([]);
});

test("bytes that do not match their declared type are rejected with a plain reason", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.acceptanceHostileUploader);
  await page.goto(uploadsNewPath);
  await chooseImage(page, "liar.jpg", "image/jpeg", createDecodablePng(16, 16));
  await expect(
    page.getByText("The file contents do not match its type").first(),
  ).toBeVisible({ timeout: processingTimeout });
  await page.goto(uploadsStudioPath);
  await expect(page.getByText("Rejected")).toBeVisible();
});

test("an image with oversized dimensions is rejected before it is decoded", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.acceptanceHostileUploader);
  await page.goto(uploadsNewPath);
  await chooseImage(
    page,
    "huge.png",
    "image/png",
    createUndecodablePng(9_000, 10),
  );
  await expect(
    page.getByText("too large in width or height").first(),
  ).toBeVisible({ timeout: processingTimeout });
});
