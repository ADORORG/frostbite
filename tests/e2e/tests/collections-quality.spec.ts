import {
  collectionNewPath,
  collectionStudioPath,
} from "@frostbite/shared/collections";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { create, detailOf, draftBody } from "./support/collection-helpers.ts";
import {
  closeMatrix,
  passBreadcrumb,
  prepare,
  skipToMain,
} from "./support/quality.ts";

// Layout, keyboard, reduced-motion, accessibility, and visual coverage of the collection pages in
// deterministic states, on every viewport project. The list is checked empty (a creator with no
// drafts); the wizard on its first step (a draft with no images, so no signed URLs or dates appear).

test("the collections list closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(
    page,
    baseURL,
    creatorE2EFixtures.collectionQualityList.sessionToken,
  );
  await page.goto(collectionStudioPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Collections" }),
  ).toBeVisible();
  await expect(page.getByText("No collections yet")).toBeVisible();
  // The button appears once the creator's standing is known.
  await expect(
    page.getByRole("link", { name: "New collection", exact: true }),
  ).toBeVisible();

  // Keyboard, with real key presses: past the skip link and the breadcrumb, Tab reaches the page's
  // main action, then the empty state's own, in reading order. Both lead to the page that starts one.
  await skipToMain(page);
  await passBreadcrumb(page);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "New collection", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Start your first collection" }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Start your first collection" }).blur();
  await closeMatrix(page, "collections-empty.png");
});

test("the new collection page closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(
    page,
    baseURL,
    creatorE2EFixtures.collectionQualityList.sessionToken,
  );
  await page.goto(collectionNewPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "New collection" }),
  ).toBeVisible();
  // The form appears once the creator's standing is known.
  await expect(page.getByLabel("Collection name")).toBeVisible();

  // Keyboard: past the skip link and the breadcrumb, Tab reaches the form in reading order, then the way back.
  await skipToMain(page);
  await passBreadcrumb(page);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Collection name")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Planned supply")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Target chain")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Create collection" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Cancel" })).toBeFocused();
  await page.getByRole("link", { name: "Cancel" }).blur();
  await closeMatrix(page, "collection-new.png");
});

test("the collection wizard closes the experience-quality matrix on its first step", async ({
  baseURL,
  page,
}) => {
  await prepare(
    page,
    baseURL,
    creatorE2EFixtures.collectionQualityWizard.sessionToken,
  );
  const key = `quality-${Date.now()}-${test.info().project.name}`;
  const created = await create(
    page.request,
    baseURL,
    key,
    draftBody({ description: "", name: "Quality draft" }),
  );
  const draft = await detailOf(created);
  await page.goto(`${collectionStudioPath}/${draft.collection.id}`);
  await expect(
    page.getByRole("heading", { level: 3, name: "Details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Quality draft" }),
  ).toBeVisible();

  // Keyboard: past the skip link, the steps come first, in order, and a step can be chosen with Enter.
  await skipToMain(page);
  await passBreadcrumb(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "1. Details" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "2. Supply and chain" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "1. Details" }).focus();
  await page.getByRole("button", { name: "1. Details" }).blur();
  await closeMatrix(page, "collection-wizard-details.png");

  // Choosing a step with the keyboard moves focus to its heading.
  await page.getByRole("button", { name: "3. Images" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 3, name: "Images" }),
  ).toBeFocused();
});
