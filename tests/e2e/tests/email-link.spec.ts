import { accountOutcomes } from "@frostbite/shared/account-outcomes";

import { expect, test } from "@playwright/test";
import { authMethodsResponseSchema } from "@frostbite/auth";

import { testWallets } from "@frostbite/auth/test-fixtures";
import {
  addAddress,
  addressList,
  lampOf,
  signedInAccount,
  unique,
} from "./support/email-account.ts";
import { installFakeWallet, walletButton } from "./support/fake-wallet.ts";

// Adding and removing an email address on an account that is already signed in, and linking a wallet to an account that signed in by
// email, against a real server and database. The accounts are made directly in the database with a session of their own, so these tests
// spend none of the sign-in-by-email request limit that the sign-in spec uses.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

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
