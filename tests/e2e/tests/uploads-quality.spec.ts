import { uploadsNewPath, uploadsStudioPath } from "@ador/shared/uploads";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import {
  closeMatrix,
  passBreadcrumb,
  prepare,
  skipToMain,
} from "./support/quality.ts";

// Layout, keyboard, reduced-motion, accessibility, and visual coverage of the uploads pages in their
// empty state, on every viewport project. A user with no uploads keeps the state deterministic.
test("the uploads library closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.otherUploader.sessionToken);
  await page.goto(uploadsStudioPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Uploads" }),
  ).toBeVisible();
  await expect(page.getByText("Nothing uploaded yet")).toBeVisible();

  // Keyboard, with real key presses: past the skip link and the breadcrumb, Tab reaches the page's main
  // action, then the empty state's own, in reading order. Both lead to the page that adds an image.
  await skipToMain(page);
  await passBreadcrumb(page);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Upload an image", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Upload your first image" }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Upload your first image" }).blur();
  await closeMatrix(page, "uploads-empty.png");
});

test("the upload page closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.otherUploader.sessionToken);
  await page.goto(uploadsNewPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Upload an image" }),
  ).toBeVisible();

  // Keyboard: past the skip link and the breadcrumb, Tab reaches the purpose select, then the file control.
  await skipToMain(page);
  await passBreadcrumb(page);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("What is this image for?")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator('input[type="file"]')).toBeFocused();
  await expect(page.locator(".arcade-file-drop")).toHaveCSS(
    "outline-style",
    "solid",
  );
  await page.locator('input[type="file"]').blur();
  await closeMatrix(page, "uploads-new.png");
});
