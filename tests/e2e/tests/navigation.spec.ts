import { expect, test, type Page } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { walletButton } from "./support/fake-wallet.ts";
import {
  accountLink,
  siteLink,
  siteNavigation,
} from "./support/site-navigation.ts";
import { useE2ESession } from "../src/session.ts";

const more = (page: Page) => page.getByRole("navigation", { name: "More" });

test("a visitor reaches every public surface by clicking, and is offered nothing private", async ({
  page,
}) => {
  await page.goto("/");
  // The bar is short: the public catalogs. No private areas, no account page. The wallet widget sits beside it.
  await expect((await siteNavigation(page)).getByRole("link")).toHaveText([
    "Collections",
    "Games",
  ]);
  await expect(walletButton(page)).toHaveText("Connect wallet");
  await expect(page.getByRole("link", { name: "Studio" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Account" })).toHaveCount(0);

  const destinations = [
    ["site", "Collections", /\/collections$/],
    ["site", "Games", /\/games$/],
    ["more", "Launches", /\/launches$/],
    ["more", "Creators", /\/creators$/],
  ] as const;
  for (const [where, label, destination] of destinations) {
    await page.goto("/");
    await (
      where === "site"
        ? await siteLink(page, label)
        : more(page).getByRole("link", { name: label, exact: true })
    ).click();
    await expect(page).toHaveURL(destination);
    // Collections shows whatever has been approved and Games the registered games; the other catalogs
    // have nothing published yet.
    await expect(
      label === "Collections" || label === "Games"
        ? page
            .getByRole("heading", {
              name: new RegExp(`^${label}`, "u"),
              level: 2,
            })
            .or(page.getByText(/^No (collections|games) yet$/u))
        : page.getByText(/^No (launches|creators) yet$/u),
    ).toBeVisible();
  }
});

test("a signed-in person keeps their links on public pages and finds the account link", async ({
  baseURL,
  context,
  page,
}) => {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(
    context,
    baseURL,
    creatorE2EFixtures.visualUser.sessionToken,
  );
  await page.goto("/collections");
  await expect(await siteLink(page, "Studio")).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await (await accountLink(page)).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("heading", { exact: true, name: "Account" }),
  ).toBeVisible();
});

test("a signed-in creator moves through the studio by its sidebar, with a way back", async ({
  baseURL,
  context,
  page,
}) => {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(
    context,
    baseURL,
    creatorE2EFixtures.visualUser.sessionToken,
  );
  await page.goto("/");
  await (await siteLink(page, "Studio")).click();
  await expect(
    page.getByRole("heading", { name: "Creator studio" }),
  ).toBeVisible();
  const sidebar = page.getByRole("navigation", { name: "Studio sections" });
  await expect(sidebar.getByRole("link")).toHaveText([
    "Overview",
    "Collections",
    "Uploads",
    "Creator application",
  ]);
  await expect(sidebar.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await sidebar.getByRole("link", { name: "Creator application" }).click();
  await expect(
    page.getByRole("heading", { name: "Apply to create" }),
  ).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await breadcrumb.getByRole("link", { name: "Studio" }).click();
  await expect(
    page.getByRole("heading", { name: "Creator studio" }),
  ).toBeVisible();
});

test("staff without the reviewer role reach the admin console and see no review links", async ({
  baseURL,
  context,
  page,
}) => {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(context, baseURL, creatorE2EFixtures.staff.sessionToken);
  await page.goto("/");
  await (await siteLink(page, "Admin")).click();
  await expect(
    page.getByRole("heading", { name: "Admin console" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Creator reviews" })).toHaveCount(
    0,
  );
  // Their one area is offered, and the overview no longer says there is none.
  await expect(page.getByText("No staff areas yet")).toHaveCount(0);
  await page.getByRole("link", { name: "Game rewards" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Game rewards" }),
  ).toBeVisible();
});

test("a reviewer's Admin entry opens a page they may use, and the sidebar lists their review work", async ({
  baseURL,
  context,
  page,
}) => {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(
    context,
    baseURL,
    creatorE2EFixtures.reviewer.sessionToken,
  );
  await page.goto("/account");
  await (await siteLink(page, "Admin")).click();
  // The reviewer has no admin overview, so the entry opens the review queue rather than a refusal.
  await expect(
    page.getByRole("heading", { name: "Collection reviews" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Admin sections" })
    .getByRole("link", { name: "Creator reviews", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Creator reviews", level: 1 }),
  ).toBeVisible();
});
