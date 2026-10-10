import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";

test("reaches every public surface from visible navigation", async ({
  page,
}) => {
  const destinations = [
    ["Launches", /\/launches$/],
    ["Collections", /\/collections$/],
    ["Creators", /\/creators$/],
    ["Games", /\/games$/],
  ] as const;

  for (const [label, destination] of destinations) {
    await page.goto("/");
    await page.getByRole("link", { name: label, exact: true }).click();
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
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Authentication required")).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Connect", exact: true }).click();
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

test("reaches creator tools from an authenticated account", async ({
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
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Studio", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Creator studio" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Apply to create", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Apply to create" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("shows only staff links authorized for the signed-in user", async ({
  baseURL,
  context,
  page,
}) => {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(context, baseURL, creatorE2EFixtures.staff.sessionToken);
  await page.goto("/");
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page.getByRole("link", { name: "Creator reviews" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Admin console" }),
  ).toBeVisible();
});

test("shows creator reviews only to an authorized reviewer", async ({
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
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await page
    .getByRole("link", { name: "Creator reviews", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review creator admission" }),
  ).toBeVisible();
});
