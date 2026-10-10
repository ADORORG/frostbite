import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

import { useE2ESession } from "../../src/session.ts";

// The shared steps of an experience-quality check: sign in with reduced motion, close the matrix
// (layout, accessibility, visual), and press through the skip link. Specs add their own keyboard order.
export async function prepare(
  page: Page,
  baseURL: string | undefined,
  token: string,
) {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(page.context(), baseURL, token);
  await page.emulateMedia({ reducedMotion: "reduce" });
}

export async function closeMatrix(page: Page, name: string) {
  // A picture still loading would make the screenshot depend on timing.
  await page.waitForFunction(() =>
    [...document.images].every((image) => image.complete),
  );
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

export async function skipToMain(page: Page) {
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
}

// Inside a work area the breadcrumb is the first thing in the main content, ahead of the page's own controls:
// one stop for each link in it.
export async function passBreadcrumb(page: Page) {
  const links = page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link");
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press("Tab");
    await expect(links.nth(index)).toBeFocused();
  }
}
