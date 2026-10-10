import { expect, test, type Page } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { post } from "../src/upload-api.ts";
import { signIn } from "../src/upload-helpers.ts";
import { createReadyCollection } from "./support/collection-helpers.ts";

// Submission and review in real browsers on real services: a creator submits a ready collection, a
// reviewer asks for changes, the creator revises and submits again, and the reviewer approves. Desktop
// only, and serial: each step builds on the one before.
test.describe.configure({ mode: "serial", timeout: 240_000 });

const name = "Review journey collection";
const creator = creatorE2EFixtures.reviewJourneyCreator;
const reviewer = creatorE2EFixtures.reviewer;
const feedback = "Please describe how the lights were drawn.";
let collectionId = "";

const wizardUrl = () => `/studio/collections/${collectionId}`;

async function asReviewer(
  baseURL: string | undefined,
  browser: import("@playwright/test").Browser,
): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signIn(page, baseURL, reviewer);
  return page;
}

async function openSubmission(page: Page, sequence: number) {
  await page.goto("/admin/collection-reviews");
  await page
    .getByRole("link", { name: `Open ${name}, submission ${String(sequence)}` })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Review a submission" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: `Cover image for ${name}` }),
  ).toBeVisible();
}

async function decide(page: Page, action: string, words?: string) {
  await page.getByRole("radio", { name: action }).check();
  if (words !== undefined)
    await page.getByLabel("Feedback for the creator").fill(words);
  await page.getByRole("button", { name: "Record decision" }).click();
}

test("a creator submits a ready collection and sees it waiting for a reviewer", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creator);
  const built = await createReadyCollection(
    page.request,
    baseURL,
    name,
    "review-journey",
  );
  collectionId = built.id;
  await page.goto(wizardUrl());
  // Everything is filled in, so the wizard opens on the review step with nothing missing.
  await expect(
    page.getByRole("heading", { level: 3, name: "Review" }),
  ).toBeVisible();
  await expect(page.getByText("Still needed")).toHaveCount(0);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Submission 1: Submitted")).toBeVisible();
  await expect(page.getByRole("button", { name: /submit/iu })).toHaveCount(0);
  // Submitted is not approved: nothing is public yet.
  await page.goto(`/collections/${collectionId}`);
  await expect(page.getByText("Record not published")).toBeVisible();
});

test("a reviewer reads the frozen version with its art and asks for changes", async ({
  baseURL,
  browser,
}) => {
  const page = await asReviewer(baseURL, browser);
  await openSubmission(page, 1);
  await expect(page.getByText("A small ready collection")).toBeVisible();
  await expect(page.getByRole("img", { name: "1. Dawn" })).toBeVisible();
  await decide(page, "Start review");
  await expect(page.getByText("State: under-review")).toBeVisible();
  await decide(page, "Request changes", feedback);
  await expect(page.getByText("State: changes-requested")).toBeVisible();
  await expect(page.getByText(`Told the creator: ${feedback}`)).toBeVisible();
  await expect(
    page.getByText("No further decisions are possible"),
  ).toBeVisible();
  await page.context().close();
});

test("the creator reads the feedback, changes the collection, and submits again", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creator);
  await page.goto(wizardUrl());
  await page.getByRole("button", { name: "5. Review" }).click();
  await expect(page.getByText("Submission 1: Changes requested")).toBeVisible();
  await expect(page.getByText(feedback, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "History of this submission" }),
  ).toContainText("Changes requested");
  await page.getByRole("button", { name: "1. Details" }).click();
  await page
    .getByLabel("Description")
    .fill("A small ready collection, drawn by hand");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByRole("button", { name: "5. Review" }).click();
  await page.getByRole("button", { name: "Submit again" }).click();
  await expect(page.getByText("Submission 2: Submitted")).toBeVisible();
});

test("the reviewer approves the new version and the creator sees it approved, with nothing published", async ({
  baseURL,
  browser,
  page,
}) => {
  const staff = await asReviewer(baseURL, browser);
  await openSubmission(staff, 2);
  await expect(
    staff.getByText("A small ready collection, drawn by hand", { exact: true }),
  ).toBeVisible();
  await decide(staff, "Start review");
  await expect(staff.getByText("State: under-review")).toBeVisible();
  await decide(staff, "Approve");
  await expect(staff.getByText("State: approved")).toBeVisible();
  await staff.context().close();

  await signIn(page, baseURL, creator);
  await page.goto(wizardUrl());
  await page.getByRole("button", { name: "5. Review" }).click();
  await expect(page.getByText("Submission 2: Approved")).toBeVisible();
  await expect(page.getByText("does not publish or launch it")).toBeVisible();
  await expect(page.getByRole("button", { name: /submit/iu })).toHaveCount(0);
});

test("the activity log shows who did what, newest first, and the creator's history shows what happened", async ({
  baseURL,
  browser,
  page,
}) => {
  const staff = await asReviewer(baseURL, browser);
  await staff.goto("/admin/collection-activity");
  const log = staff.getByRole("list", { name: "Review activity" });
  await expect(log).toContainText(`approved ${name}, submission 2`);
  await expect(log).toContainText(`requested changes on ${name}, submission 1`);
  await expect(log).toContainText(`submitted ${name}, submission 1`);
  // Newest first: the approval comes before the first submission.
  const text = await log.innerText();
  expect(text.indexOf(`approved ${name}`)).toBeLessThan(
    text.indexOf(`submitted ${name}, submission 1`),
  );
  await staff
    .getByRole("link", { name: `Open ${name}, submission 2` })
    .first()
    .click();
  await expect(staff.getByText("Creator standing: approved")).toBeVisible();
  await expect(staff.getByText(/started review of it/u).first()).toBeVisible();
  await staff.context().close();

  await signIn(page, baseURL, creator);
  await page.goto(wizardUrl());
  await page.getByRole("button", { name: "5. Review" }).click();
  const history = page.getByRole("list", {
    name: "History of this submission",
  });
  await expect(history).toContainText("Submitted");
  await expect(history).toContainText("Approved");
  // The creator never sees who decided.
  await expect(page.getByText("E2E reviewer")).toHaveCount(0);
  await expect(history).not.toContainText(creatorE2EFixtures.reviewer.userId);
});

test("once approved the collection is public, as the version that was approved, to anyone", async ({
  baseURL,
  browser,
}) => {
  const visitor = await browser.newContext({ baseURL });
  const page = await visitor.newPage();
  await page.goto("/collections");
  await expect(page.getByText("Approved by review")).toBeVisible();
  await page.getByRole("link", { name: `View ${name}` }).click();
  await expect(page).toHaveURL(
    new RegExp(`/collections/${collectionId}$`, "u"),
  );
  await expect(
    page.getByText("Approved by review. Not yet minted."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(
    page.getByText("A small ready collection, drawn by hand", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: `Cover image for ${name}` }).first(),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "1. Dawn" })).toBeVisible();
  await expect(page.getByText("Items (1)")).toBeVisible();
  // Nothing of the creator or the review reaches the visitor.
  const text = await page.locator("body").innerText();
  for (const private_ of [creator.userId, "reviewer-", feedback])
    expect(text).not.toContain(private_);
  await visitor.close();
});

test("people without the reviewer role cannot read or decide on submissions", async ({
  baseURL,
  browser,
  page,
}) => {
  await signIn(page, baseURL, creator);
  for (const path of [
    "/api/v1/collection-reviews/queue",
    "/api/v1/collection-reviews/read",
    "/api/v1/collection-reviews/decide",
  ]) {
    const response = await post(page.request, baseURL, path, {});
    expect(response.status()).toBe(403);
  }
  const anonymous = await browser.newContext({ baseURL });
  const refused = await post(
    anonymous.request,
    baseURL,
    "/api/v1/collection-reviews/queue",
    {
      states: ["submitted"],
    },
  );
  expect(refused.status()).toBe(401);
  await anonymous.close();
});
