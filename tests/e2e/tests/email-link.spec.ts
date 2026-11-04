import { accountOutcomes } from "@ador/shared/account-outcomes";
import { createHash, randomUUID } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  authSessions,
  authUsers,
  contactIdentities,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@ador/database";
import { readCapturedMail } from "@ador/mail";
import { createUuidV7 } from "@ador/shared/identifiers";
import {
  authMethodsResponseSchema,
  emailAddressesResponseSchema,
} from "@ador/auth";

import { useE2ESession } from "../src/session.ts";
import { testWallets } from "@ador/auth/test-fixtures";
import { installFakeWallet, walletButton } from "./support/fake-wallet.ts";

// Adding and removing an email address on an account that is already signed in, and linking a wallet to an account that signed in by
// email, against a real server and database. The accounts are made directly in the database with a session of their own, so these tests
// spend none of the sign-in-by-email request limit that the sign-in spec uses.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const unique = () => `${randomUUID().slice(0, 8)}@example.test`;
const lampOf = (page: Page) => page.locator("p[role=status]");

// An account that holds `address`, with a session just signed in, as the browser's cookie.
async function signedInAccount(
  context: BrowserContext,
  baseURL: string | undefined,
  address: string,
) {
  const pool = createDatabasePool(parseDatabaseEnvironment(process.env));
  const token = `e2e-email-link-${randomUUID()}`;
  const userId = createUuidV7();
  try {
    const database = createDatabaseClient(pool);
    const now = new Date();
    await database.insert(authUsers).values({
      email: `contact-${userId}@contact.invalid`,
      id: userId,
      name: "E2E email user",
    });
    await database.insert(contactIdentities).values({
      id: createUuidV7(),
      kind: "email",
      userId,
      value: address,
      verifiedAt: now,
    });
    await database.insert(authSessions).values({
      absoluteExpiresAt: new Date(now.getTime() + 86_400_000),
      authenticatedAt: now,
      id: createUuidV7(),
      idleExpiresAt: new Date(now.getTime() + 3_600_000),
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId,
    });
  } finally {
    await pool.end();
  }
  await useE2ESession(context, baseURL ?? "", token);
  return { userId };
}

// More addresses for an account, put straight into the database (each a minute after the one before): the way to fill an account up
// without a code for every one.
async function holdAddresses(userId: string, addresses: readonly string[]) {
  const pool = createDatabasePool(parseDatabaseEnvironment(process.env));
  try {
    const database = createDatabaseClient(pool);
    const first = Date.now() - 3_600_000;
    for (const [at, address] of addresses.entries())
      await database.insert(contactIdentities).values({
        createdAt: new Date(first + at * 60_000),
        id: createUuidV7(),
        kind: "email",
        userId,
        value: address,
        verifiedAt: new Date(first + at * 60_000),
      });
  } finally {
    await pool.end();
  }
}

async function codeSentTo(address: string): Promise<string> {
  const directory = process.env.MAIL_CAPTURE_DIRECTORY;
  if (directory === undefined) throw new Error("The run has no mailbox.");
  let code: string | undefined;
  await expect
    .poll(async () => {
      const mail = (await readCapturedMail(directory)).find(
        ({ to }) => to === address,
      );
      code = /sign-in code is (\d{6})/u.exec(mail?.text ?? "")?.[1];
      return code;
    })
    .toBeDefined();
  if (code === undefined) throw new Error("No code arrived.");
  return code;
}

async function addAddress(page: Page, address: string) {
  await page.getByLabel("Add an email address").fill(address);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByLabel(`Code sent to ${address}`)).toBeVisible();
  await page
    .getByLabel(`Code sent to ${address}`)
    .fill(await codeSentTo(address));
  await page.getByRole("button", { name: "Add address" }).click();
}

const addressesOf = async (page: Page) =>
  emailAddressesResponseSchema.parse(
    await (await page.request.get("/api/v1/email/addresses")).json(),
  );

// Just the addresses, oldest first, as the list route gives them.
const addressList = async (page: Page) =>
  (await addressesOf(page)).addresses.map(({ address }) => address);

test("a signed-in person adds an email address with a code, sees it listed after a reload, and removes it again", async ({
  baseURL,
  context,
  page,
}) => {
  const first = unique();
  const second = unique();
  await signedInAccount(context, baseURL, first);
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Email addresses" }),
  ).toBeVisible();
  await expect(page.getByText(first, { exact: true })).toBeVisible();

  await addAddress(page, second);
  await expect(lampOf(page).filter({ hasText: "Address added" })).toBeVisible();
  await page.reload();
  await expect(page.getByText(second, { exact: true })).toBeVisible();
  expect(await addressList(page)).toEqual([first, second]);

  await page.getByRole("button", { name: `Remove ${second}` }).click();
  await expect(
    lampOf(page).filter({ hasText: "Address removed" }),
  ).toBeVisible();
  expect(await addressList(page)).toEqual([first]);

  // The only way in cannot be removed, in the page or by asking the server.
  await page.getByRole("button", { name: `Remove ${first}` }).click();
  await expect(
    lampOf(page).filter({ hasText: "only way to sign in" }),
  ).toBeVisible();
  expect(await addressList(page)).toEqual([first]);
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

test("an address another account holds cannot be added, and nothing says whose it is", async ({
  baseURL,
  browser,
  context,
}) => {
  const taken = unique();
  const mine = unique();
  const other = await browser.newContext({ baseURL });
  await signedInAccount(other, baseURL, taken);
  await signedInAccount(context, baseURL, mine);
  const page = await context.newPage();
  await page.goto("/account");
  await addAddress(page, taken);
  await expect(
    lampOf(page).filter({ hasText: accountOutcomes["email-taken"].message }),
  ).toBeVisible();
  expect(await addressList(page)).toEqual([mine]);
  await other.close();
});

test("a person who signed in by email links a wallet from the account page, and the account then holds both", async ({
  baseURL,
  context,
  page,
}) => {
  const wallet = testWallets[10];
  await signedInAccount(context, baseURL, unique());
  await installFakeWallet(page, wallet);
  await page.goto("/account");
  // Signed in by email with no wallet, the header's button is "Account"; wallets are linked on this page, not from the header.
  await expect(walletButton(page)).toHaveText("Account");
  await page.getByRole("button", { name: "Connect a wallet" }).click();
  await page
    .getByRole("button", { name: "Connect UniSat", exact: true })
    .click();
  await expect(walletButton(page)).toContainText(wallet.address.slice(0, 6));
  await page.getByRole("button", { name: /^Link tb1/u }).click();
  // While the wallet signs the button's words change, so it is the server's record that says the link happened.
  await expect
    .poll(async () => {
      const response = await page.request.get("/api/v1/auth/methods");
      return response.ok()
        ? authMethodsResponseSchema.parse(await response.json()).wallets.length
        : 0;
    })
    .toBe(1);
  await expect(page.getByRole("button", { name: /^Link tb1/u })).toHaveCount(0);
  const methods = authMethodsResponseSchema.parse(
    await (await page.request.get("/api/v1/auth/methods")).json(),
  );
  expect(methods.wallets.map(({ address }) => address)).toEqual([
    wallet.address,
  ]);
  expect(await addressList(page)).toHaveLength(1);
});
