import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { publicCollection } from "../src/creator-fixtures.ts";
import { closeMatrix, skipToMain } from "./support/quality.ts";

// Layout, keyboard, reduced-motion, accessibility, and visual coverage of the public collection pages
// on every viewport project. The detail page is checked in full for the seeded approved collection
// (fixed content, previews unavailable). The list holds whatever other specs have approved, so it is
// checked for accessibility and keyboard order as a page and visually by the seeded collection's card.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the public collection list closes the experience-quality matrix", async ({
  page,
}) => {
  await page.goto("/collections");
  await expect(
    page.getByRole("heading", { level: 2, name: "Collections" }),
  ).toBeVisible();
  const card = page.getByRole("article", { name: publicCollection.name });
  await expect(card).toBeVisible();
  await expect(
    page.getByText("does not mean they are minted, listed, or on sale"),
  ).toBeVisible();

  // Keyboard: past the skip link, the collections are reachable in reading order.
  await skipToMain(page);
  await page
    .getByRole("link", { name: `View ${publicCollection.name}` })
    .focus();
  await expect(
    page.getByRole("link", { name: `View ${publicCollection.name}` }),
  ).toBeFocused();
  await page
    .getByRole("link", { name: `View ${publicCollection.name}` })
    .blur();

  await expect(page.locator(".app-shell")).toHaveJSProperty(
    "scrollWidth",
    await page.locator(".app-shell").evaluate((shell) => shell.clientWidth),
  );
  await page.addStyleTag({
    content: ".skip-link { visibility: hidden !important; }",
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await expect(card).toHaveScreenshot("public-collection-card.png", {
    animations: "disabled",
  });
});

test("an approved collection's page closes the experience-quality matrix", async ({
  page,
}) => {
  await page.goto(`/collections/${publicCollection.id}`);
  await expect(
    page.getByRole("heading", { level: 2, name: publicCollection.name }),
  ).toBeVisible();
  await expect(
    page.getByText("Approved by review. Not yet minted."),
  ).toBeVisible();
  await skipToMain(page);
  await closeMatrix(page, "public-collection-detail.png");
});

test("a collection that is not published closes the experience-quality matrix", async ({
  page,
}) => {
  await page.goto("/collections/018f22f2-9c1a-7b21-8c45-0000000000ff");
  await expect(page.getByText("Record not published")).toBeVisible();
  await closeMatrix(page, "public-collection-not-published.png");
});
