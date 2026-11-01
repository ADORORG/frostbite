import { expect, type Locator, type Page } from "@playwright/test";

import { openWalletMenu, walletMenu } from "./fake-wallet.ts";

const bar = (page: Page) =>
  page.getByRole("navigation", { name: "Primary navigation" });
const menu = (page: Page) => page.locator("details.nav-menu");

// The site's links as the width of the screen offers them, for a person to click: the bar where there is room to lay it out, and where
// there is not, the Menu, opened the way a person opens it. A test that clicks "Studio" is about getting to the studio, not about which of
// the two the page chose.
export async function siteNavigation(page: Page): Promise<Locator> {
  const trigger = menu(page).locator("summary");
  // Both are in the page at every width and one of them is hidden, so wait until one of them can be used.
  await expect
    .poll(
      async () => (await bar(page).isVisible()) || (await trigger.isVisible()),
    )
    .toBe(true);
  if (await bar(page).isVisible()) return bar(page);
  if (
    !(await menu(page).evaluate((details: HTMLDetailsElement) => details.open))
  )
    await trigger.click();
  return menu(page).getByRole("navigation", { name: "Menu" });
}

// A link of the site's navigation by its exact name, in the bar or in the Menu. The account page is `accountLink`.
export async function siteLink(page: Page, name: string): Promise<Locator> {
  return (await siteNavigation(page)).getByRole("link", { exact: true, name });
}

// The way to the account page as the width offers it: in the Menu when the bar is folded away, and otherwise in the menu of the widget
// at the end of the header (its button reads "Account" for someone signed in with no wallet connected).
export async function accountLink(page: Page): Promise<Locator> {
  const navigation = await siteNavigation(page);
  if (!(await bar(page).isVisible()))
    return navigation.getByRole("link", { exact: true, name: "Account" });
  await openWalletMenu(page);
  return walletMenu(page).getByRole("link", {
    name: "Account and sign-in methods",
  });
}
