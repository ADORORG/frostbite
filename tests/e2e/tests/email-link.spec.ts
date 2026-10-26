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
import { testWallets } from "../../../packages/auth/test/support/fixtures.ts";
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
  try {
    const database = createDatabaseClient(pool);
    const userId = createUuidV7();
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
  expect((await addressesOf(page)).addresses).toEqual([first, second]);

  await page.getByRole("button", { name: `Remove ${second}` }).click();
  await expect(
    lampOf(page).filter({ hasText: "Address removed" }),
  ).toBeVisible();
  expect((await addressesOf(page)).addresses).toEqual([first]);

  // The only way in cannot be removed, in the page or by asking the server.
  await page.getByRole("button", { name: `Remove ${first}` }).click();
  await expect(
    lampOf(page).filter({ hasText: "only way to sign in" }),
  ).toBeVisible();
  expect((await addressesOf(page)).addresses).toEqual([first]);
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
  expect((await addressesOf(page)).addresses).toEqual([mine]);
  await other.close();
});

test("a person who signed in by email links a wallet from the header, and the account then holds both", async ({
  baseURL,
  context,
  page,
}) => {
  const wallet = testWallets[10];
  await signedInAccount(context, baseURL, unique());
  await installFakeWallet(page, wallet);
  await page.goto("/");
  // Signed in by email with no wallet, the header's button is "Account" and its menu offers to connect one.
  await expect(walletButton(page)).toHaveText("Account");
  await walletButton(page).click();
  await page
    .getByRole("dialog", { name: "Wallet" })
    .getByRole("button", { name: "Connect wallet" })
    .click();
  await page
    .getByRole("button", { name: "Connect UniSat", exact: true })
    .click();
  await expect(walletButton(page)).toContainText(wallet.address.slice(0, 6));
  // The menu may still be open from the chooser, or not; either way it is open when the next step needs it.
  const menu = page.getByRole("dialog", { name: "Wallet" });
  if (!(await menu.isVisible())) await walletButton(page).click();
  await expect(menu).toContainText("This wallet is not linked to your account");
  await menu.getByRole("button", { name: "Link this wallet" }).click();
  await expect(menu).not.toContainText(
    "This wallet is not linked to your account",
  );
  const methods = authMethodsResponseSchema.parse(
    await (await page.request.get("/api/v1/auth/methods")).json(),
  );
  expect(methods.wallets.map(({ address }) => address)).toEqual([
    wallet.address,
  ]);
  expect((await addressesOf(page)).addresses).toHaveLength(1);
});
