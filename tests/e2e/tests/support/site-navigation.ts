import { expect, type Locator, type Page } from "@playwright/test";

const bar = (page: Page) =>
  page.getByRole("navigation", { name: "Primary navigation" });
const menu = (page: Page) => page.locator("details.nav-menu");

// The site's links as the width of the screen offers them, for a person to click: the bar where there is room to lay it out, and where
// there is not, the Menu, opened the way a person opens it. A test that clicks "Studio" is about getting to the studio, not about which of
// the two the page chose.
export async function siteNavigation(page: Page): Promise<Locator> {
  await expect(bar(page).or(menu(page).locator("summary"))).toBeVisible();
  if (await bar(page).isVisible()) return bar(page);
  if (
    !(await menu(page).evaluate((details: HTMLDetailsElement) => details.open))
  )
    await menu(page).locator("summary").click();
  return menu(page).getByRole("navigation", { name: "Menu" });
}

// A link of the site's navigation by its exact name.
export async function siteLink(page: Page, name: string): Promise<Locator> {
  return (await siteNavigation(page)).getByRole("link", { exact: true, name });
}
