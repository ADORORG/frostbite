import { collectionListResponseSchema } from "@ador/shared/collections";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";
import { origin } from "../src/upload-api.ts";
import { signIn } from "../src/upload-helpers.ts";
import { draftsPath, uploadProcessed } from "./support/collection-helpers.ts";

// The collection wizard in a real browser on real services: a creator who uploaded images builds a
// draft step by step, leaves, and comes back to the step that still needs work. Desktop only.
test.describe.configure({ mode: "serial", timeout: 180_000 });

const step = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("heading", { level: 3, name });

test("a creator builds a draft in the browser, leaves, and resumes where it stands", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.collectionWizardCreator);
  // Images come from the creator's own uploads; they are made through the API (one at a time, as only
  // a few unfinished uploads are allowed at once) so this spec is about the wizard.
  await uploadProcessed(
    page.request,
    baseURL,
    "wizard-cover-00000001",
    "collection-artwork",
  );
  await uploadProcessed(
    page.request,
    baseURL,
    "wizard-image-0000001",
    "collection-item-artwork",
  );

  await page.goto("/studio/collections");
  await expect(
    page.getByText("No collections yet. Start one below."),
  ).toBeVisible();
  await page.getByLabel("Collection name").fill("Browser built");
  await page.getByLabel("Planned supply").fill("2");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page).toHaveURL(/\/studio\/collections\/[0-9a-f-]{36}$/u);

  // Details, then supply: saved as the creator goes.
  await expect(step(page, "Details")).toBeVisible();
  await page.getByLabel("Description").fill("About the collection");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(step(page, "Supply and chain")).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Images: the cover comes from the library.
  await expect(step(page, "Images")).toBeVisible();
  await page
    .getByRole("group", { name: "Cover image" })
    .getByRole("radio")
    .nth(1)
    .check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Items: one item with an image and a trait.
  await expect(step(page, "Items")).toBeVisible();
  await expect(page.getByText("0 of 2 items")).toBeVisible();
  await page.getByLabel("Item name").fill("Item one");
  await page
    .getByRole("group", { name: "Item image" })
    .getByRole("radio")
    .first()
    .check();
  await page.getByRole("button", { name: "Add a trait" }).click();
  await page.getByLabel("Trait 1 name").fill("Colour");
  await page.getByLabel("Trait 1 value").fill("Blue");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("1 of 2 items")).toBeVisible();
  await expect(page.getByText("1. Item one")).toBeVisible();

  // Leaving and coming back: the list shows the draft, and the wizard opens where it still asks for
  // something (here nothing is missing, so review), with the same content from the server.
  await page.goto("/studio/collections");
  await expect(page.getByText("1 of 2 items")).toBeVisible();
  await page.getByRole("link", { name: "Continue Browser built" }).click();
  await expect(step(page, "Review")).toBeVisible();
  await expect(
    page.getByText("Not ready to submit yet. It needs every planned item."),
  ).toBeVisible();

  const list = collectionListResponseSchema.parse(
    await (await page.request.get(draftsPath)).json(),
  );
  expect(
    list.collections.map(({ itemCount, name }) => [name, itemCount]),
  ).toEqual([["Browser built", 1]]);
});

test("a stale page is told its draft changed elsewhere and can reload it", async ({
  baseURL,
  browser,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.collectionWizardCreator);
  await page.goto("/studio/collections");
  await page.getByRole("link", { name: "Continue Browser built" }).click();
  await expect(step(page, "Review")).toBeVisible();
  await page.getByRole("button", { name: "1. Details" }).click();

  // A second tab saves a change; this page still holds the older revision.
  const other = await browser.newContext({ baseURL });
  await useE2ESession(
    other,
    origin(baseURL),
    creatorE2EFixtures.collectionWizardCreator.sessionToken,
  );
  const second = await other.newPage();
  await second.goto(page.url());
  await second.getByRole("button", { name: "1. Details" }).click();
  await second.getByLabel("Collection name").fill("Renamed in another tab");
  await second.getByRole("button", { name: "Save", exact: true }).click();
  await expect(second.getByText("Saved.")).toBeVisible();
  await other.close();

  await page.getByLabel("Description").fill("Edited in the stale page");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("The draft changed since it was loaded"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reload the draft" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Renamed in another tab" }),
  ).toBeVisible();
});
