import { expect, test } from "@playwright/test";
import { creatorApplicationResponseSchema } from "@ador/shared/creator-admission";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";

test("persists, submits, and reviews a creator application", async ({
  baseURL,
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One stateful E2E journey");
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(
    context,
    baseURL,
    creatorE2EFixtures.applicant.sessionToken,
  );
  await page.goto("/studio/creator-application");
  await expect(
    page.getByRole("heading", { name: "Apply to create" }),
  ).toBeVisible();
  await page.getByLabel("Display name").fill("E2E Creator");
  await page.getByLabel("Portfolio URL").fill("https://example.test/portfolio");
  await page.getByLabel("Project summary").fill("A verified creator project.");
  await page.getByLabel("Expected launch size").fill("Small beta cohort");
  await page.getByLabel("Expected launch timing").fill("After review");
  for (const checkbox of await page.getByRole("checkbox").all()) {
    await checkbox.check();
  }
  const draftResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/creator-application/draft"),
  );
  await page.getByRole("button", { name: "Save private draft" }).click();
  const draftResponse = await draftResponsePromise;
  expect(draftResponse.status(), await draftResponse.text()).toBe(200);
  await expect(
    page.getByText("Private draft saved. State: draft."),
  ).toBeVisible();
  const submitResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/creator-application/submit"),
  );
  await page.getByRole("button", { name: "Submit snapshot" }).click();
  const submitResponse = await submitResponsePromise;
  expect(submitResponse.status(), await submitResponse.text()).toBe(200);
  // Sent: the card says so and the form gives way to what was sent, so it cannot be sent twice.
  await expect(
    page.getByRole("article", { name: "Application status" }),
  ).toContainText("Application submitted");
  await expect(
    page.getByRole("heading", { name: "What you sent" }),
  ).toBeVisible();
  await expect(page.getByText("E2E Creator")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit snapshot" }),
  ).toHaveCount(0);

  const mine = creatorApplicationResponseSchema.parse(
    await submitResponse.json(),
  );
  if (mine.application === null) throw new Error("Expected application");

  await useE2ESession(
    context,
    baseURL,
    creatorE2EFixtures.reviewer.sessionToken,
  );
  await page.goto("/admin/creator-applications");
  await expect(
    page.getByRole("heading", { name: "Review creator admission" }),
  ).toBeVisible();
  await page.getByLabel("Application UUID").fill(mine.application.id);
  await page.getByLabel("Reason code").fill("review-started");
  await page.getByLabel("Creator feedback").fill("Review has started.");
  await page
    .getByLabel("Evidence URL (private)")
    .fill("https://example.test/review-evidence");
  const reviewResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/creator-application/review"),
  );
  await page.getByRole("button", { name: "Record decision" }).click();
  const reviewResponse = await reviewResponsePromise;
  expect(reviewResponse.status(), await reviewResponse.text()).toBe(200);
  await expect(
    page.getByText("Decision recorded. State: under-review."),
  ).toBeVisible();

  await page.getByLabel("Decision").selectOption("approve");
  await page.getByLabel("Reason code").fill("creator-approved");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(
    page.getByText("Decision recorded. State: approved."),
  ).toBeVisible();
});
