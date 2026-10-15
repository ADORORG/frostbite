import { AxeBuilder } from "@axe-core/playwright";
import { createDecodablePng, createUndecodablePng } from "@ador/test-kit/png";
import { uploadsNewPath, uploadsStudioPath } from "@ador/shared/uploads";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { loadFonts } from "./support/quality.ts";
import {
  chooseImage,
  processingTimeout,
  signIn,
} from "../src/upload-helpers.ts";

// The flows run real services (Postgres, S3-compatible storage, the worker, a signed Inngest runtime)
// and take seconds each, so playwright.config runs this spec on the desktop project only; the quality
// spec covers every viewport.
test.describe.configure({ mode: "serial", timeout: 150_000 });

test("a signed-in user uploads an image and sees its processed thumbnail, which survives a reload", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.uploader);
  await page.goto(uploadsStudioPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Uploads" }),
  ).toBeVisible();
  await expect(page.getByText("Nothing uploaded yet")).toBeVisible();
  await page.getByRole("link", { name: "Upload your first image" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Upload an image" }),
  ).toBeVisible();

  await chooseImage(page, "art.png", "image/png", createDecodablePng(64, 48));
  await expect(page.getByText("Upload processed")).toBeVisible({
    timeout: processingTimeout,
  });
  await page.getByRole("link", { name: "See your library" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Uploads" }),
  ).toBeVisible();

  const thumbnail = page.getByRole("img", {
    name: "Collection artwork thumbnail",
  });
  await expect(thumbnail).toBeVisible();
  // Never enlarged: a 64x48 source keeps its size, and the browser really decoded the signed URL.
  await expect
    .poll(() =>
      thumbnail.evaluate((image: HTMLImageElement) => [
        image.naturalWidth,
        image.naturalHeight,
      ]),
    )
    .toEqual([64, 48]);
  await expect(page.getByText("Ready")).toBeVisible();
  await loadFonts(page);
  await expect(
    page.getByRole("list", { name: "Your uploaded images" }),
  ).toHaveScreenshot("library-ready.png", { animations: "disabled" });

  await page.reload();
  await expect(
    page.getByRole("img", { name: "Collection artwork thumbnail" }),
  ).toBeVisible();

  // The image has a page of its own, reached from the library and back again.
  await page.getByRole("link", { name: /^Details:/u }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Image" }),
  ).toBeVisible();
  const details = page.getByRole("article", { name: "Image details" });
  await expect(details.getByText("Ready")).toBeVisible();
  await expect(details.getByText("64 × 48 px")).toBeVisible();
  await expect(details.getByRole("img")).toBeVisible();
  // The image page meets the same accessibility bar as the rest, and its picture and layout are pinned
  // (the upload date changes every day, so it is masked).
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await loadFonts(page);
  await expect(details).toHaveScreenshot("image-detail.png", {
    animations: "disabled",
    mask: [details.locator("dl")],
  });
  await details.getByRole("link", { name: "Back to your library" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Uploads" }),
  ).toBeVisible();
});

test("another user never sees that image, and anonymous callers cannot list assets", async ({
  baseURL,
  browser,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.otherUploader);
  await page.goto(uploadsStudioPath);
  await expect(page.getByText("Nothing uploaded yet")).toBeVisible();
  const own = await page.request.get("/api/v1/uploads/assets");
  expect(await own.json()).toEqual({ assets: [], nextCursor: null });

  const anonymous = await browser.newContext({ baseURL });
  const response = await anonymous.request.get("/api/v1/uploads/assets");
  expect(response.status()).toBe(401);
  await anonymous.close();
});

test("a file that is not an image is rejected with a plain explanation", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.rejectedUploader);
  await page.goto(uploadsNewPath);
  await chooseImage(
    page,
    "fake.png",
    "image/png",
    Buffer.from("this is not an image at all"),
  );
  await expect(
    page
      .getByText("This image format is not supported. Use PNG, JPEG, or WebP.")
      .first(),
  ).toBeVisible({
    timeout: processingTimeout,
  });
  await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
  await page.goto(uploadsStudioPath);
  await expect(page.getByText("Rejected")).toBeVisible();
});

test("a structurally valid but undecodable image is reported as unusable", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.undecodableUploader);
  await page.goto(uploadsNewPath);
  await chooseImage(
    page,
    "broken.png",
    "image/png",
    createUndecodablePng(32, 32),
  );
  await expect(page.getByText(/could not be read/i).first()).toBeVisible({
    timeout: processingTimeout,
  });
  await page.goto(uploadsStudioPath);
  await expect(page.getByText("Unusable")).toBeVisible();
});

test("an unsupported file type never reaches the server", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.localCheckUploader);
  const intentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/uploads/intents"))
      intentRequests.push(request.url());
  });
  await page.goto(uploadsNewPath);
  await chooseImage(page, "animation.gif", "image/gif", Buffer.from("GIF89a"));
  await expect(
    page.getByText("Only PNG, JPEG, and WebP images can be uploaded."),
  ).toBeVisible();
  expect(intentRequests).toEqual([]);
});

test("an interrupted transfer can be retried without starting over", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.retryUploader);
  await page.goto(uploadsNewPath);
  let interrupted = false;
  await page.route(/\/e2e-private-drafts\//u, (route) => {
    if (route.request().method() === "PUT" && !interrupted) {
      interrupted = true;
      return route.abort("connectionreset");
    }
    return route.continue();
  });
  await chooseImage(page, "retry.png", "image/png", createDecodablePng(40, 40));
  await expect(page.getByText(/could not be sent/i)).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Upload processed")).toBeVisible({
    timeout: processingTimeout,
  });
  await page.getByRole("link", { name: "See your library" }).click();
  await expect(
    page.getByRole("img", { name: "Collection artwork thumbnail" }),
  ).toBeVisible();
});

for (const path of [uploadsStudioPath, uploadsNewPath])
  test(`${path} requires a session`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText("Authentication required")).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });
