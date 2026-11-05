import { accountOutcomes } from "@frostbite/shared/account-outcomes";

import { expect, test } from "@playwright/test";
import { readCapturedMail } from "@frostbite/mail";

import {
  addAddress,
  addressesOf,
  holdAddresses,
  lampOf,
  signedInAccount,
  unique,
} from "./support/email-account.ts";

// How many email addresses an account may hold, and when each was added, against a real server and database: the page at the limit, the
// server's refusal, and the page that was open while the account filled up.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("each address shows the day it was added, and an account at its limit is offered nothing to add until one is removed", async ({
  baseURL,
  context,
  page,
}) => {
  const first = unique();
  const { userId } = await signedInAccount(context, baseURL, first);
  await page.goto("/account");
  // The limit is the server's: read it, then fill the account to one below it directly in the database.
  const { maximum } = await addressesOf(page);
  // What this test needs of the platform's number: room for the account's own address, one filler to leave a place, and the last one.
  expect(maximum).toBeGreaterThanOrEqual(3);
  const filler = Array.from({ length: maximum - 2 }, unique);
  await holdAddresses(userId, filler);
  await page.reload();
  const dates = page.getByText(/^Added \d{1,2} [A-Z][a-z]{2} \d{4}$/u);
  await expect(dates).toHaveCount(maximum - 1);
  await expect(
    page.getByText(`Up to ${String(maximum)} can be linked`),
  ).toBeVisible();

  // The last address that fits is added through the page, with a code, and is listed with the day it was added.
  const last = unique();
  await addAddress(page, last);
  await expect(lampOf(page).filter({ hasText: "Address added" })).toBeVisible();
  await expect(dates).toHaveCount(maximum);
  const { addresses } = await addressesOf(page);
  // Oldest first: the ones put in the database an hour back, then the account's own first address, then the one just added.
  expect(addresses.map(({ address }) => address)).toEqual([
    ...filler,
    first,
    last,
  ]);
  expect(addresses).toHaveLength(maximum);
  expect(
    addresses.every(({ addedAt }) => !Number.isNaN(Date.parse(addedAt))),
  ).toBe(true);

  // Full: nothing to add is offered, and the page says why in the catalogue's words.
  await expect(page.getByLabel("Add an email address")).toHaveCount(0);
  await expect(
    page.getByText(accountOutcomes["email-limit-reached"].message),
  ).toBeVisible();

  // Asking the server directly gets the same answer, and no code is mailed for it.
  const over = unique();
  const answer = await page.evaluate(async (email) => {
    const response = await fetch("/api/v1/email/link/request", {
      body: JSON.stringify({ email }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    return {
      body: JSON.stringify(await response.json()),
      status: response.status,
    };
  }, over);
  expect(answer.status).toBe(409);
  expect(answer.body).toContain(accountOutcomes["email-limit-reached"].message);
  const directory = process.env.MAIL_CAPTURE_DIRECTORY;
  if (directory === undefined) throw new Error("The run has no mailbox.");
  expect(
    (await readCapturedMail(directory)).filter(({ to }) => to === over),
  ).toEqual([]);

  // Removing one makes room: the form comes back and the count falls.
  await page.getByRole("button", { name: `Remove ${last}` }).click();
  await expect(
    lampOf(page).filter({ hasText: "Address removed" }),
  ).toBeVisible();
  await expect(page.getByLabel("Add an email address")).toBeVisible();
  await expect(dates).toHaveCount(maximum - 1);
});

test("a page that was open when the account filled up is told the limit by the server, in the catalogue's words, and nothing is mailed", async ({
  baseURL,
  context,
  page,
}) => {
  const first = unique();
  const { userId } = await signedInAccount(context, baseURL, first);
  await page.goto("/account");
  const { maximum } = await addressesOf(page);
  await holdAddresses(userId, Array.from({ length: maximum - 2 }, unique));
  await page.reload();
  await expect(page.getByLabel("Add an email address")).toBeVisible();
  // Another session fills the last place while this page is still showing the form.
  await holdAddresses(userId, [unique()]);
  const refused = unique();
  await page.getByLabel("Add an email address").fill(refused);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(
    lampOf(page).filter({
      hasText: accountOutcomes["email-limit-reached"].message,
    }),
  ).toBeVisible();
  // It stays on the address step: no code was asked for, and none was mailed.
  await expect(page.getByLabel(`Code sent to ${refused}`)).toHaveCount(0);
  const directory = process.env.MAIL_CAPTURE_DIRECTORY;
  if (directory === undefined) throw new Error("The run has no mailbox.");
  expect(
    (await readCapturedMail(directory)).filter(({ to }) => to === refused),
  ).toEqual([]);
});
