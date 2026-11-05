import { createDecodablePng } from "@frostbite/test-kit/png";
import { libraryResponseSchema } from "@frostbite/shared/uploads";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { signIn } from "../src/upload-helpers.ts";

// Many images at once, in a real browser on real storage and a real worker: the creator chooses a batch
// in one go, the batch goes up a few at a time, and every image keeps its own name. Desktop only.
test.describe.configure({ mode: "serial", timeout: 240_000 });

// More files than can be in flight at once, so the batch has to queue and carry on.
const names = Array.from(
  { length: 12 },
  (_, at) => `piece-${String(at + 1).padStart(2, "0")}.png`,
);

test("a creator uploads a batch of named images in one go from the items step", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.collectionBulkCreator);
  await page.goto("/studio/collections/new");
  await page.getByLabel("Collection name").fill("Uploaded in bulk");
  await page.getByLabel("Planned supply").fill("12");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page).toHaveURL(/\/studio\/collections\/[0-9a-f-]{36}$/u);
  await page.getByRole("button", { name: "4. Items" }).click();

  await page.getByText("Upload many images at once").click();
  await page.locator('input[type="file"][multiple]').setInputFiles([
    ...names.map((name) => ({
      buffer: createDecodablePng(16, 16),
      mimeType: "image/png",
      name,
    })),
    // A file that cannot be used is turned away and does not hold up the others.
    {
      buffer: Buffer.from("GIF89a"),
      mimeType: "image/gif",
      name: "moving.gif",
    },
  ]);
  await expect(page.getByText("12 of 13 ready, 1 not accepted.")).toBeVisible({
    timeout: 180_000,
  });
  const files = page.getByRole("list", { name: "Files in this upload" });
  await expect(files.getByText("moving.gif")).toBeVisible();

  // Every image is in the library with the name it had.
  const library = libraryResponseSchema.parse(
    await (await page.request.get("/api/v1/uploads/assets")).json(),
  );
  expect(
    library.assets
      .filter(({ purpose }) => purpose === "collection-item-artwork")
      .map(({ fileName }) => fileName)
      .sort(),
  ).toEqual([...names].sort());
});
