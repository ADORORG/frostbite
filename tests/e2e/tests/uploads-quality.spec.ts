import { AxeBuilder } from "@axe-core/playwright";
import { uploadsStudioPath } from "@ador/shared/uploads";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";
import { passBreadcrumb } from "./support/quality.ts";

// Layout, keyboard, reduced-motion, accessibility, and visual coverage of the uploads page in its
// empty state, on every viewport project. A user with no uploads keeps the state deterministic.
test("the uploads page closes the experience-quality matrix", async ({
  baseURL,
  context,
  page,
}) => {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(
    context,
    baseURL,
    creatorE2EFixtures.otherUploader.sessionToken,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(uploadsStudioPath);

  await expect(
    page.getByRole("heading", { level: 1, name: "Uploads" }),
  ).toBeVisible();
  await expect(page.getByText("Nothing uploaded yet")).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveJSProperty(
    "scrollWidth",
    await page.locator(".app-shell").evaluate((shell) => shell.clientWidth),
  );

  await expect(page.locator(".scanlines")).toHaveCSS("display", "none");

  // Keyboard, with real key presses only: the skip link comes first and moves focus to the main
  // content, then Tab reaches the purpose select, then the file control.
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
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
  // Focus scrolled the page; capture from a fixed position so the masked regions line up.
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.addStyleTag({
    content: [
      ".skip-link { visibility: hidden !important; }",
      ".status-lamp__light { box-shadow: none !important; }",
    ].join("\n"),
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await expect(page).toHaveScreenshot("uploads-empty.png", {
    animations: "disabled",
    fullPage: true,
    mask: [page.locator(".status-lamp__light")],
  });
});
