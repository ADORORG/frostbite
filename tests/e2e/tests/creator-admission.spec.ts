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
    page.getByRole("heading", { name: "Creator reviews" }),
  ).toBeVisible();
  const decide = async (action: string, reasonCode: string, words = "") => {
    await page.getByRole("combobox", { name: "Decision" }).selectOption(action);
    await page.getByLabel("Reason code").fill(reasonCode);
    await page.getByLabel("Creator feedback").fill(words);
    await page.getByRole("button", { name: "Record decision" }).click();
  };
  // The reviewer finds the application in the list and opens it; nobody types an identifier.
  await page
    .getByRole("link", { name: /^Open E2E Creator, submission 1$/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review an application" }),
  ).toBeVisible();
  await decide("start-review", "review-started", "Review has started.");
  await expect(page.getByText("Status: In review")).toBeVisible();
  const asked = "Please add a link to your earlier work.";
  await decide("request-changes", "needs-more-evidence", asked);
  await expect(page.getByText("Status: Changes requested")).toBeVisible();
  // The history shows both decisions, with the words the applicant was told.
  await expect(
    page.getByRole("list", { name: "History of this application" }),
  ).toContainText(`Told the applicant: ${asked}`);

  // The applicant reads what the reviewer wrote, still has the form, and sends it again.
  await useE2ESession(
    context,
    baseURL,
    creatorE2EFixtures.applicant.sessionToken,
  );
  await page.goto("/studio/creator-application");
  const message = page.getByRole("article", {
    name: "Message from a reviewer",
  });
  await expect(message).toContainText(asked);
  await expect(
    page.getByRole("article", { name: "Application status" }),
  ).toContainText("Changes requested");
  await page.getByLabel("Portfolio URL").fill("https://example.test/earlier");
  await page.getByRole("button", { name: "Save private draft" }).click();
  await expect(
    page.getByText("Private draft saved. State: changes-requested."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit snapshot" }).click();
  await expect(
    page.getByRole("article", { name: "Application status" }),
  ).toContainText("Application submitted");
  // The old message is not shown against the new submission.
  await expect(message).toHaveCount(0);

  await useE2ESession(
    context,
    baseURL,
    creatorE2EFixtures.reviewer.sessionToken,
  );
  await page.goto("/admin/creator-applications");
  // The second submission is waiting again, and the list says it is the second.
  await page
    .getByRole("link", { name: /^Open E2E Creator, submission 2$/ })
    .click();
  await decide("start-review", "review-restarted");
  await expect(page.getByText("Status: In review")).toBeVisible();
  await decide("approve", "creator-approved");
  await expect(page.getByText("Status: Approved")).toBeVisible();
  // Approved applications leave the waiting list.
  await page.getByRole("link", { name: "Back to the queue" }).click();
  await expect(
    page.getByRole("link", { name: /^Open E2E Creator/ }),
  ).toHaveCount(0);
});
