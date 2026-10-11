import { expect, test, type Browser, type Page } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { signIn } from "../src/upload-helpers.ts";
import { uploadProcessed } from "./support/collection-helpers.ts";

// The Week 4 internal-alpha acceptance journey, start to finish in real browsers on real services. An
// approved creator uploads art, builds a collection (items and traits from a file), leaves and resumes,
// submits it, keeps editing after submission, and a reviewer asks for changes and later approves. It
// proves what the gate asks: the reviewed version is frozen, later edits never reach it or the public
// page, and nothing is represented as published or deployed. Desktop only, serial.
test.describe.configure({ mode: "serial", timeout: 300_000 });

const creator = creatorE2EFixtures.alphaCreator;
const reviewer = creatorE2EFixtures.reviewer;
const name = "Alpha acceptance";
const feedback = "Please say how the pieces were made.";
let collectionId = "";

const wizardUrl = () => `/studio/collections/${collectionId}`;
const step = (page: Page, label: string) =>
  page.getByRole("heading", { level: 3, name: label });

async function asReviewer(
  baseURL: string | undefined,
  browser: Browser,
): Promise<Page> {
  const page = await (await browser.newContext({ baseURL })).newPage();
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
}

async function decide(page: Page, action: string, words?: string) {
  await page.getByRole("radio", { name: action }).check();
  if (words !== undefined)
    await page.getByLabel("Feedback for the creator").fill(words);
  await page.getByRole("button", { name: "Record decision" }).click();
}

async function renameItem(page: Page, from: string, to: string) {
  await page.getByRole("button", { name: "4. Items" }).click();
  await page.getByRole("button", { name: `Edit ${from}` }).click();
  await page.getByLabel("Item name").fill(to);
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByText(`1. ${to}`)).toBeVisible();
}

test("a creator uploads art, builds a collection from a file, leaves and resumes, and submits", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creator);
  await uploadProcessed(
    page.request,
    baseURL,
    "alpha-cover-0000001",
    "collection-artwork",
    "cover.png",
  );
  for (const [at, file] of ["alpha.png", "bravo.png"].entries())
    await uploadProcessed(
      page.request,
      baseURL,
      `alpha-item-${String(at).padStart(8, "0")}`,
      "collection-item-artwork",
      file,
    );

  await page.goto("/studio/collections/new");
  await page.getByLabel("Collection name").fill(name);
  await page.getByLabel("Planned supply").fill("2");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page).toHaveURL(/\/studio\/collections\/[0-9a-f-]{36}$/u);
  collectionId = new URL(page.url()).pathname.split("/").pop() ?? "";

  await page.getByLabel("Description").fill("Two pieces made for the alpha");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(step(page, "Supply and chain")).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(step(page, "Images")).toBeVisible();
  await page
    .getByRole("group", { name: "Cover image" })
    .getByRole("radio")
    .nth(1)
    .check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(step(page, "Items")).toBeVisible();
  await page.getByText("Add many items from a file").click();
  await page.locator('input[type="file"][accept*=".csv"]').setInputFiles({
    buffer: Buffer.from(
      [
        "name,description,image,trait:Background",
        "Alpha,First,alpha.png,Blue",
        "Bravo,Second,bravo.png,Red",
      ].join("\n"),
    ),
    mimeType: "text/csv",
    name: "items.csv",
  });
  await page.getByRole("button", { name: "Add 2 items" }).click();
  await expect(page.getByText("2 of 2 items")).toBeVisible();

  // Leave, and resume where the collection stands.
  await page.goto("/studio/collections");
  await page.getByRole("link", { name: `Continue editing: ${name}` }).click();
  await expect(step(page, "Review")).toBeVisible();
  await expect(page.getByText("Still needed")).toHaveCount(0);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Submission 1: Submitted")).toBeVisible();
  // Submitted is not approved and nothing is public.
  await page.goto(`/collections/${collectionId}`);
  await expect(page.getByText("Record not published")).toBeVisible();
});

test("editing after submitting does not change what the reviewer reads, and they ask for changes", async ({
  baseURL,
  browser,
  page,
}) => {
  await signIn(page, baseURL, creator);
  await page.goto(wizardUrl());
  await renameItem(page, "Alpha", "Alpha edited after submitting");

  const staff = await asReviewer(baseURL, browser);
  await openSubmission(staff, 1);
  await expect(staff.getByRole("img", { name: "1. Alpha" })).toBeVisible();
  await expect(staff.locator("body")).not.toContainText("edited after");
  await decide(staff, "Start review");
  await expect(staff.getByText("Status: In review")).toBeVisible();
  await decide(staff, "Request changes", feedback);
  await expect(staff.getByText("Status: Changes requested")).toBeVisible();
  await staff.context().close();

  await page.reload();
  await page.getByRole("button", { name: "5. Review" }).click();
  await expect(page.getByText("Submission 1: Changes requested")).toBeVisible();
  await expect(page.getByText(feedback, { exact: true })).toBeVisible();
});

test("the revised version is submitted again and approved, and the public sees only that version", async ({
  baseURL,
  browser,
  page,
}) => {
  await signIn(page, baseURL, creator);
  await page.goto(wizardUrl());
  await page.getByRole("button", { name: "5. Review" }).click();
  await page.getByRole("button", { name: "Submit again" }).click();
  await expect(page.getByText("Submission 2: Submitted")).toBeVisible();

  const staff = await asReviewer(baseURL, browser);
  await openSubmission(staff, 2);
  await expect(
    staff.getByRole("img", { name: "1. Alpha edited after submitting" }),
  ).toBeVisible();
  await decide(staff, "Start review");
  await decide(staff, "Approve");
  await expect(staff.getByText("Status: Approved")).toBeVisible();
  await staff.context().close();

  await page.reload();
  await page.getByRole("button", { name: "5. Review" }).click();
  await expect(page.getByText("Submission 2: Approved")).toBeVisible();
  await expect(page.getByText("does not publish or launch it")).toBeVisible();

  // Editing the draft after approval changes the draft only.
  await renameItem(page, "Alpha edited after submitting", "Draft only");

  const visitor = await (await browser.newContext({ baseURL })).newPage();
  await visitor.goto(`/collections/${collectionId}`);
  await expect(
    visitor.getByText("Approved by review. Not yet minted."),
  ).toBeVisible();
  await expect(
    visitor.getByRole("img", { name: "1. Alpha edited after submitting" }),
  ).toBeVisible();
  const text = await visitor.locator("body").innerText();
  expect(text).not.toContain("Draft only");
  // No chain deployment is represented as done.
  expect(text).not.toMatch(/deployed|live on|minted out|contract address/iu);
  await visitor.context().close();
});
