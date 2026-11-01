import { expect, test, type Page } from "@playwright/test";

import {
  creatorE2EFixtures,
  publicCollection,
} from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";
import { loadFonts } from "./support/quality.ts";
import { siteLink } from "./support/site-navigation.ts";

// One journey per kind of person, each started once at the home page and then followed by clicking only: after
// the first load, typing an address is refused, so a page that cannot be reached from another fails here
// instead of being reached by a back door. The journeys read and never change data, so they run on every
// viewport; the narrow ones prove the same links are reachable there. Desktop and mobile also keep a picture of
// the top bar with the account menu open, which is where the role shows.

const more = (page: Page) => page.getByRole("navigation", { name: "More" });
const sidebar = (page: Page, name: string) =>
  page.getByRole("navigation", { name });
const breadcrumb = (page: Page) =>
  page.getByRole("navigation", { name: "Breadcrumb" });

async function begin(page: Page, baseURL: string | undefined, token?: string) {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  if (token !== undefined) await useE2ESession(page.context(), baseURL, token);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // From here on the person has only the page's own links.
  page.goto = () => {
    throw new Error("A click-only journey must not type an address");
  };
}

async function heading(page: Page, name: string) {
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name }),
  ).toBeVisible();
}

// The top bar, kept as a baseline on desktop and mobile. A person with only the account page has one link to it, not a menu.
async function pictureOfTheBar(page: Page, name: string) {
  const project = test.info().project.name;
  if (project !== "desktop" && project !== "mobile") return;
  await loadFonts(page);
  await expect(page.getByRole("banner")).toHaveScreenshot(
    `journey-${name}-bar.png`,
    { animations: "disabled" },
  );
}

test("a visitor follows the public catalogs and finds the way to connect", async ({
  baseURL,
  page,
}) => {
  await begin(page, baseURL);
  await (await siteLink(page, "Collections")).click();
  await expect(page).toHaveURL(/\/collections$/u);
  await page
    .getByRole("link", { name: `View ${publicCollection.name}` })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/collections/${publicCollection.id}$`, "u"),
  );
  // The way back is on the page.
  await page.getByRole("link", { name: "Browse collections" }).click();
  await expect(page).toHaveURL(/\/collections$/u);
  await (await siteLink(page, "Games")).click();
  await expect(page).toHaveURL(/\/games$/u);
  await more(page).getByRole("link", { name: "Launches", exact: true }).click();
  await expect(page).toHaveURL(/\/launches$/u);
  await more(page).getByRole("link", { name: "Creators", exact: true }).click();
  await expect(page).toHaveURL(/\/creators$/u);
  await page.getByRole("link", { name: "Frostbit home" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("link", { name: "Studio" })).toHaveCount(0);
});

test("someone who never applied is led from the studio to the application and back", async ({
  baseURL,
  page,
}) => {
  await begin(page, baseURL, creatorE2EFixtures.visualUser.sessionToken);
  await (await siteLink(page, "Studio")).click();
  await heading(page, "Creator studio");
  await sidebar(page, "Studio sections")
    .getByRole("link", { name: "Collections", exact: true })
    .click();
  await expect(
    page.getByText("Collections open once you are an approved creator"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Apply to create" }).click();
  await heading(page, "Apply to create");
  await breadcrumb(page).getByRole("link", { name: "Studio" }).click();
  await heading(page, "Creator studio");
  await (await siteLink(page, "Account")).click();
  await heading(page, "Account");
  await pictureOfTheBar(page, "applicant");
});

test("an approved creator reaches collections, uploads and their application", async ({
  baseURL,
  page,
}) => {
  await begin(
    page,
    baseURL,
    creatorE2EFixtures.collectionQualityList.sessionToken,
  );
  await (await siteLink(page, "Studio")).click();
  await heading(page, "Creator studio");
  const studio = sidebar(page, "Studio sections");
  await studio.getByRole("link", { name: "Collections", exact: true }).click();
  await page.getByRole("link", { name: "New collection" }).click();
  await expect(page.getByLabel("Collection name")).toBeVisible();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/studio\/collections$/u);
  await studio.getByRole("link", { name: "Uploads", exact: true }).click();
  await heading(page, "Uploads");
  await page.getByRole("link", { name: "Upload an image" }).first().click();
  await heading(page, "Upload an image");
  await breadcrumb(page).getByRole("link", { name: "Uploads" }).click();
  await heading(page, "Uploads");
  await studio
    .getByRole("link", { name: "Creator application", exact: true })
    .click();
  // Approved: the status card and what was sent, no form to send it again.
  await expect(
    page.getByRole("article", { name: "Application status" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit snapshot" }),
  ).toHaveCount(0);
  await breadcrumb(page).getByRole("link", { name: "Studio" }).click();
  await heading(page, "Creator studio");
  await pictureOfTheBar(page, "creator");
});

test("a reviewer moves between the review queues and never sees the console", async ({
  baseURL,
  page,
}) => {
  await begin(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  await (await siteLink(page, "Admin")).click();
  await heading(page, "Collection reviews");
  const admin = sidebar(page, "Admin sections");
  await admin
    .getByRole("link", { name: "Creator reviews", exact: true })
    .click();
  await heading(page, "Creator reviews");
  // Every group is a click away, each with its size.
  for (const group of [
    "All",
    "Needs review",
    "Approved or paused",
    "Finished",
  ]) {
    await page
      .getByRole("button", { name: new RegExp(`^${group}`, "u") })
      .click();
    await expect(
      page.getByRole("button", { name: new RegExp(`^${group}`, "u") }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await admin
    .getByRole("link", { name: "Collection reviews", exact: true })
    .click();
  await heading(page, "Collection reviews");
  await pictureOfTheBar(page, "reviewer");
});

test("staff without the reviewer role see their console and no review links", async ({
  baseURL,
  page,
}) => {
  await begin(page, baseURL, creatorE2EFixtures.staff.sessionToken);
  await (await siteLink(page, "Admin")).click();
  await heading(page, "Admin console");
  // Staff have one area now: the rewards contracts of games.
  await expect(page.getByText("No staff areas yet")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Game rewards" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Creator reviews" })).toHaveCount(
    0,
  );
  await (await siteLink(page, "Account")).click();
  await heading(page, "Account");
  await pictureOfTheBar(page, "staff");
});
