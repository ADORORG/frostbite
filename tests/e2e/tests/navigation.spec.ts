import { expect, test, type Page } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";

const bar = (page: Page) =>
  page.getByRole("navigation", { name: "Primary navigation" });
const more = (page: Page) => page.getByRole("navigation", { name: "More" });

test("a visitor reaches every public surface by clicking, and is offered nothing private", async ({
  page,
}) => {
  await page.goto("/");
  // The bar is short: the public catalogs and one way to connect. No private areas, no account page.
  await expect(bar(page).getByRole("link")).toHaveText([
    "Collections",
    "Games",
    "Connect",
  ]);
  await expect(page.getByRole("link", { name: "Studio" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Account" })).toHaveCount(0);

  const destinations = [
    [bar, "Collections", /\/collections$/],
    [bar, "Games", /\/games$/],
    [more, "Launches", /\/launches$/],
    [more, "Creators", /\/creators$/],
  ] as const;
  for (const [where, label, destination] of destinations) {
    await page.goto("/");
    await where(page).getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(destination);
    // Collections shows whatever has been approved; the other catalogs have nothing published yet.
    await expect(
      page.getByText(
        label === "Collections"
          ? /Catalog empty|Approved by review/u
          : "Catalog empty",
      ),
    ).toBeVisible();
  }

  await page.goto("/");
  await bar(page).getByRole("link", { name: "Connect", exact: true }).click();
  await expect(page).toHaveURL(/\/connect$/);
  await expect(
    page.getByRole("heading", { name: "Connect a candidate wallet" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose wallet", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Choose your wallet" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect Xverse", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose wallet", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText("Signing in remains disabled", { exact: false }),
  ).toBeVisible();
});

test("a signed-in person keeps their links on public pages and finds the account menu", async ({
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
  await expect(
    bar(page).getByRole("link", { name: "Studio", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await bar(page).locator("summary", { hasText: "Account" }).click();
  await bar(page).getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("heading", { name: "Account console" }),
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
  await bar(page).getByRole("link", { name: "Studio", exact: true }).click();
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
  await bar(page).getByRole("link", { name: "Admin", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Admin console" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Creator reviews" })).toHaveCount(
    0,
  );
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
  await bar(page).getByRole("link", { name: "Admin", exact: true }).click();
  // The reviewer has no admin overview, so the entry opens the review queue rather than a refusal.
  await expect(
    page.getByRole("heading", { name: "Collection reviews" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Admin sections" })
    .getByRole("link", { name: "Creator reviews", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review creator admission" }),
  ).toBeVisible();
});
