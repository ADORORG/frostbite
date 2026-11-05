import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";
import { siteLink } from "./support/site-navigation.ts";

// The studio's front page as each kind of person finds it, reached and used by clicking only.

test("a person who never applied is told so, sent to the application, and not offered collections", async ({
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
    page.getByRole("heading", { name: "Not a creator yet" }),
  ).toBeVisible();
  const next = page.getByRole("region", { name: "Next step" });
  await expect(
    next.getByRole("link", { name: "Apply to create" }),
  ).toBeVisible();
  // No way to start a collection from here, since it would be refused.
  await expect(page.getByRole("link", { name: "New collection" })).toHaveCount(
    0,
  );

  await page
    .getByRole("navigation", { name: "Studio sections" })
    .getByRole("link", { name: "Collections", exact: true })
    .click();
  await expect(
    page.getByText("Collections open once you are an approved creator"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "New collection" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Apply to create" }).click();
  await expect(
    page.getByRole("heading", { name: "Apply to create" }),
  ).toBeVisible();
});

test("an approved creator is pointed to their first collection and reaches the form from there", async ({
  baseURL,
  context,
  page,
}) => {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(
    context,
    baseURL,
    creatorE2EFixtures.collectionQualityList.sessionToken,
  );
  await page.goto("/");
  await (await siteLink(page, "Studio")).click();
  await expect(
    page.getByRole("heading", { name: "Approved creator" }),
  ).toBeVisible();
  const next = page.getByRole("region", { name: "Next step" });
  await expect(next.getByText("You have no collections yet.")).toBeVisible();
  await next.getByRole("link", { name: "Start your first collection" }).click();
  await expect(page).toHaveURL(/\/studio\/collections\/new$/u);
  await expect(page.getByLabel("Collection name")).toBeVisible();
  // The way back is on the page, not the browser's button.
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/studio\/collections$/u);
});
