import { createDecodablePng } from "@ador/test-kit/png";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { post } from "../src/upload-api.ts";
import { signIn } from "../src/upload-helpers.ts";
import { detailOf, readPath } from "./support/collection-helpers.ts";

// Images are uploaded where they are used: a creator adds a cover and a banner from inside the wizard's
// images step, on real storage and a real worker, and never leaves the page. Desktop only.
test.describe.configure({ mode: "serial", timeout: 180_000 });

const png = (name: string) => ({
  buffer: createDecodablePng(16, 16),
  mimeType: "image/png",
  name,
});

test("a creator uploads a cover and a banner inside the wizard and never leaves it", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.collectionInlineCreator);
  await page.goto("/studio/collections");
  await page.getByRole("link", { name: "Start your first collection" }).click();
  await page.getByLabel("Collection name").fill("Uploaded in place");
  await page.getByLabel("Planned supply").fill("1");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page).toHaveURL(/\/studio\/collections\/[0-9a-f-]{36}$/u);
  const wizardPath = new URL(page.url()).pathname;

  await page.getByRole("button", { name: "3. Images" }).click();
  const cover = page.getByRole("group", { name: "Cover image" });
  const banner = page.getByRole("group", { name: "Banner image" });
  // A new creator has no images, and the way to add one is right here.
  await expect(cover.getByText("You have no ready images")).toBeVisible();
  await expect(banner.getByText("You have no ready images")).toBeVisible();

  await cover.locator('input[type="file"]').setInputFiles(png("cover.png"));
  await expect(cover.getByRole("radio", { checked: true })).toHaveCount(1, {
    timeout: 90_000,
  });
  // The cover is chosen without clicking it, and the banner is untouched.
  await expect(cover.getByText("You have no ready images")).toHaveCount(0);
  await expect(banner.getByText("You have no ready images")).toBeVisible();

  await banner
    .locator('input[type="file"]')
    .first()
    .setInputFiles(png("banner.png"));
  await expect(banner.getByText("You have no ready images")).toHaveCount(0, {
    timeout: 90_000,
  });
  await expect(banner.getByRole("radio", { checked: true })).toHaveCount(1);
  // Still on the same page (only the step's fragment changed).
  expect(new URL(page.url()).pathname).toBe(wizardPath);

  // What was chosen is saved with the draft, like any other choice.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const id = wizardPath.split("/").pop();
  const saved = await detailOf(
    await post(page.request, baseURL, readPath, { collectionId: id }),
  );
  expect(saved.collection.coverAssetId).not.toBeNull();
  expect(saved.collection.bannerAssetId).not.toBeNull();
  expect(saved.collection.coverAssetId).not.toBe(
    saved.collection.bannerAssetId,
  );
});
