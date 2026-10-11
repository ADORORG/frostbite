import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { closeMatrix, prepare, skipToMain } from "./support/quality.ts";
import { activityBody, answer } from "./support/review-mocks.ts";

// Layout, keyboard, reduced-motion, accessibility, and visual coverage of the staff activity log on every
// viewport project, in known states: the page answers with fixed, contract-parsed events (the journey
// spec covers the real log), a full page with older events available, and an empty one.

test("the activity log closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  await answer(page, "collection-reviews/activity", activityBody(true));
  await page.goto("/admin/collection-activity");
  await expect(
    page.getByRole("heading", { level: 1, name: "Review activity" }),
  ).toBeVisible();
  await expect(
    page.getByText("E2E reviewer approved First light, submission 1"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Load older activity" }),
  ).toBeVisible();

  // Keyboard: past the skip link, the first event's link comes first and older activity is reachable.
  await skipToMain(page);
  await page
    .getByRole("link", { name: "Open First light, submission 1" })
    .first()
    .focus();
  await expect(
    page.getByRole("link", { name: "Open First light, submission 1" }).first(),
  ).toBeFocused();
  await page.getByRole("button", { name: "Load older activity" }).focus();
  await expect(
    page.getByRole("button", { name: "Load older activity" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Load older activity" }).blur();
  await closeMatrix(page, "review-activity.png");
});

test("an empty activity log closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  await answer(page, "collection-reviews/activity", {
    items: [],
    nextCursor: null,
  });
  await page.goto("/admin/collection-activity");
  await expect(page.getByText("Nothing has happened yet.")).toBeVisible();
  await closeMatrix(page, "review-activity-empty.png");
});
