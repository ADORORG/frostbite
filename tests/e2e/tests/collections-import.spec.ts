import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { post } from "../src/upload-api.ts";
import { signIn } from "../src/upload-helpers.ts";
import {
  detailOf,
  readPath,
  uploadProcessed,
} from "./support/collection-helpers.ts";

// Items added from a file, in a real browser on real services: a creator whose images are uploaded lists
// their items and traits in a CSV, is told exactly what is wrong, fixes it, and adds all of it at once.
// Desktop only.
test.describe.configure({ mode: "serial", timeout: 240_000 });

const names = ["alpha.png", "bravo.png", "charlie.png"];
const header = "name,description,image,trait:Background,trait:Eyes";
const file = (lines: string[]) => ({
  buffer: Buffer.from([header, ...lines].join("\n")),
  mimeType: "text/csv",
  name: "items.csv",
});

test("a creator adds a whole list of items and traits from a file", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.collectionImportCreator);
  for (const [at, name] of names.entries())
    await uploadProcessed(
      page.request,
      baseURL,
      `import-image-${String(at).padStart(8, "0")}`,
      "collection-item-artwork",
      name,
    );

  await page.goto("/studio/collections/new");
  await page.getByLabel("Collection name").fill("Imported from a file");
  await page.getByLabel("Planned supply").fill("3");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page).toHaveURL(/\/studio\/collections\/[0-9a-f-]{36}$/u);
  const id = new URL(page.url()).pathname.split("/").pop();
  await page.getByRole("button", { name: "4. Items" }).click();
  await page.getByText("Add many items from a file").click();
  const chooser = page.locator('input[type="file"][accept*=".csv"]');

  // A row names an image that was never uploaded: everything waits, and the row is named.
  await chooser.setInputFiles(
    file([
      "Alpha,First,alpha.png,Blue,Open",
      "Bravo,Second,bravo.png,Red,Closed",
      "Delta,Third,delta.png,Green,Open",
    ]),
  );
  await expect(page.getByText("3 items found, 1 to fix.")).toBeVisible();
  await expect(
    page.getByText('None of your uploaded item images is named "delta.png"'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Add \d+ items$/u }),
  ).toHaveCount(0);

  // A row past the planned supply is told the same way.
  await chooser.setInputFiles(
    file([
      "Alpha,First,alpha.png,Blue,Open",
      "Bravo,Second,bravo.png,Red,Closed",
      "Charlie,Third,CHARLIE.PNG,Green,Open",
      "Echo,Fourth,alpha.png,Blue,Open",
    ]),
  );
  await expect(page.getByText("go past the planned supply of 3")).toBeVisible();

  // The fixed file is ready; nothing has been added yet.
  await chooser.setInputFiles(
    file([
      "Alpha,First,alpha.png,Blue,Open",
      "Bravo,Second,images/bravo.png,Red,Closed",
      "Charlie,Third,CHARLIE.PNG,Green,",
    ]),
  );
  await expect(
    page.getByText("3 items found, all ready to add."),
  ).toBeVisible();
  await expect(page.getByText("0 of 3 items")).toBeVisible();

  await page.getByRole("button", { name: "Add 3 items" }).click();
  await expect(
    page.getByText("Added 3 items to the collection."),
  ).toBeVisible();
  await expect(page.getByText("3 of 3 items")).toBeVisible();
  await expect(page.getByText("1. Alpha")).toBeVisible();
  await expect(page.getByText("3. Charlie")).toBeVisible();

  // Traits arrived and are kept: two on the first item, one on the last (an empty cell is no trait).
  const saved = await detailOf(
    await post(page.request, baseURL, readPath, { collectionId: id }),
  );
  expect(saved.items.map(({ name }) => name)).toEqual([
    "Alpha",
    "Bravo",
    "Charlie",
  ]);
  expect(saved.items.map(({ attributes }) => attributes)).toEqual([
    [
      { trait: "Background", value: "Blue" },
      { trait: "Eyes", value: "Open" },
    ],
    [
      { trait: "Background", value: "Red" },
      { trait: "Eyes", value: "Closed" },
    ],
    [{ trait: "Background", value: "Green" }],
  ]);
  await page.getByRole("button", { name: "Edit Alpha" }).click();
  await expect(page.getByLabel("Trait 2 name")).toHaveValue("Eyes");
  await expect(page.getByLabel("Trait 2 value")).toHaveValue("Open");
});
