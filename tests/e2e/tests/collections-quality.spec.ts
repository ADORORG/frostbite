import { AxeBuilder } from "@axe-core/playwright";
import { collectionStudioPath } from "@ador/shared/collections";
import { expect, test, type Page } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";
import { create, detailOf, draftBody } from "./support/collection-helpers.ts";

// Layout, keyboard, reduced-motion, accessibility, and visual coverage of the collection pages in
// deterministic states, on every viewport project. The list is checked empty (a creator with no
// drafts); the wizard on its first step (a draft with no images, so no signed URLs or dates appear).

async function prepare(page: Page, baseURL: string | undefined, token: string) {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(page.context(), baseURL, token);
  await page.emulateMedia({ reducedMotion: "reduce" });
}

async function closeMatrix(page: Page, name: string) {
  await expect(page.locator(".app-shell")).toHaveJSProperty(
    "scrollWidth",
    await page.locator(".app-shell").evaluate((shell) => shell.clientWidth),
  );
  await expect(page.locator(".scanlines")).toHaveCSS("display", "none");
  await page.addStyleTag({
    content: [
      ".skip-link { visibility: hidden !important; }",
      ".status-lamp__light { box-shadow: none !important; }",
    ].join("\n"),
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    fullPage: true,
    mask: [page.locator(".status-lamp__light")],
  });
}

async function skipToMain(page: Page) {
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
}

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
  await expect(
    page.getByText("No collections yet. Start one below."),
  ).toBeVisible();

  // Keyboard, with real key presses: past the skip link, Tab reaches the form in reading order.
  await skipToMain(page);
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
  await page.getByLabel("Collection name").blur();
  await closeMatrix(page, "collections-empty.png");
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
