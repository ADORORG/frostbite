import { expect, test } from "@playwright/test";

import { testWallets } from "../../../packages/auth/test/support/fixtures.ts";
import {
  connectWallet,
  installFakeWallet,
  openWalletMenu,
  walletButton,
  walletMenu,
} from "./support/fake-wallet.ts";

// The wallet widget in the header, in a real browser: on every page, honest about what it knows, and a connection
// that survives a reload. Connecting changes no account, so the wallet is shared; signing in is covered elsewhere.
const wallet = testWallets[0];
// Signing in creates an account that lasts the whole run, so the tests that do it have wallets of their own.
const signingWallet = testWallets[8];
const slowWallet = testWallets[9];

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("is in the header of every public page, and opens the chooser from any of them", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/games",
    "/collections",
    "/launches",
    "/creators",
  ]) {
    await page.goto(path);
    await expect(walletButton(page)).toHaveText("Connect wallet");
    await expect(page.locator(".wallet-widget")).toHaveCount(1);
  }
  await page.goto("/games");
  await walletButton(page).click();
  await expect(
    page.getByRole("dialog", { name: "Choose your wallet" }),
  ).toBeVisible();
});

test("does not fetch the wallet library until a wallet is wanted", async ({
  page,
}) => {
  // The library is large; a page that only reads should not pay for it. It is recognised by its own name in its code.
  let libraryFetches = 0;
  page.on("response", async (response) => {
    if (response.request().resourceType() !== "script") return;
    const body = await response.text().catch(() => "");
    if (/lasereyes/iu.test(body)) libraryFetches += 1;
  });
  await page.goto("/games");
  await expect(walletButton(page)).toHaveText("Connect wallet");
  await page.waitForLoadState("networkidle");
  expect(libraryFetches).toBe(0);
  await walletButton(page).click();
  await expect(
    page.getByRole("dialog", { name: "Choose your wallet" }),
  ).toBeVisible();
  await expect.poll(() => libraryFetches).toBeGreaterThan(0);
});

test("shows the connected wallet, reconnects after a reload, and forgets it when disconnected", async ({
  page,
}) => {
  await installFakeWallet(page, wallet);
  await page.goto("/games");
  await connectWallet(page, wallet);
  await expect(walletButton(page).locator("svg.avatar")).toBeVisible();
  await page.reload();
  await expect(walletButton(page)).toContainText(wallet.address.slice(0, 6));
  const menu = await openWalletMenu(page);
  await expect(menu).toContainText(wallet.address);
  await expect(menu).toContainText("Connected, not signed in.");
  await menu.getByRole("button", { name: "Disconnect wallet" }).click();
  await expect(walletButton(page)).toHaveText("Connect wallet");
  // Disconnecting is a decision: after a reload the wallet is not reconnected.
  await page.reload();
  await expect(walletButton(page)).toHaveText("Connect wallet");
});

test("asks for the balance only while the menu is open, and says honestly that there is no data source", async ({
  page,
}) => {
  await installFakeWallet(page, wallet);
  const balanceRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/wallet/balance"))
      balanceRequests.push(request.postData() ?? "");
  });
  await page.goto("/");
  await connectWallet(page, wallet);
  await page.waitForTimeout(500);
  expect(balanceRequests).toEqual([]);
  const menu = await openWalletMenu(page);
  await expect(menu).toContainText(
    "Balance unavailable: no data source is configured.",
  );
  // No figure stands in for the missing balance.
  await expect(menu.locator(".wallet-menu__balance")).not.toContainText(
    /BTC|sats/u,
  );
  expect(balanceRequests).toHaveLength(1);
  expect(JSON.parse(balanceRequests[0] ?? "{}")).toEqual({
    address: wallet.address,
    network: "signet",
  });
  await menu.getByRole("button", { name: "Refresh balance" }).click();
  await expect.poll(() => balanceRequests.length).toBe(2);
});

test("closes its menu with Escape, returning focus, and when the page is clicked elsewhere", async ({
  page,
}) => {
  await installFakeWallet(page, wallet);
  await page.goto("/");
  await connectWallet(page, wallet);
  const menu = await openWalletMenu(page);
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(walletButton(page)).toBeFocused();
  await openWalletMenu(page);
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await expect(walletMenu(page)).not.toBeVisible();
  await expect(walletButton(page)).toHaveAttribute("aria-expanded", "false");
});

test("shows the wallet again after a reload even when the extension is slow to answer, signed in or not", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await installFakeWallet(page, slowWallet);
  await page.goto("/");
  await connectWallet(page, slowWallet);
  await openWalletMenu(page);
  await walletMenu(page)
    .getByRole("button", { name: "Sign in with wallet" })
    .click();
  await expect(walletMenu(page)).toContainText("Signed in with this wallet.");
  // A fresh page of the same browser, whose wallet takes a second and a half to answer.
  const slow = await context.newPage();
  await installFakeWallet(slow, slowWallet, 1500);
  await slow.goto("/");
  // While the remembered wallet is on its way the button says so; it does not say "Account" as if there were none.
  await expect(walletButton(slow)).toHaveText("Reconnecting wallet…");
  await expect(walletButton(slow)).toContainText(
    slowWallet.address.slice(0, 6),
    {
      timeout: 10_000,
    },
  );
  await context.close();
});

test("the page follows signing in and out: the navigation changes at once, and a private page stops showing the session", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await installFakeWallet(page, signingWallet);
  await page.goto("/");
  const links = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link");
  await expect(links).toHaveText(["Collections", "Games"]);
  await connectWallet(page, signingWallet);
  await openWalletMenu(page);
  await walletMenu(page)
    .getByRole("button", { name: "Sign in with wallet" })
    .click();
  // No reload: the server-rendered bar now offers what a signed-in person may open.
  await expect(links).toHaveText(["Collections", "Games", "Studio", "Account"]);
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Account console" }),
  ).toBeVisible();
  await openWalletMenu(page);
  await walletMenu(page).getByRole("button", { name: "Sign out" }).click();
  // The private page does not go on showing the session that has just ended.
  await expect(
    page.getByRole("heading", { name: "Account console" }),
  ).toHaveCount(0);
  // With the session ended, a private page sends the visitor to sign in again, and back to it afterwards.
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Faccount$/u);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await context.close();
});

test("'Switch wallet' opens the chooser even though a wallet is connected", async ({
  page,
}) => {
  await installFakeWallet(page, wallet);
  await page.goto("/");
  await connectWallet(page, wallet);
  const menu = await openWalletMenu(page);
  await menu.getByRole("button", { name: "Switch wallet" }).click();
  const chooser = page.getByRole("dialog", { name: "Choose your wallet" });
  await expect(chooser).toBeVisible();
  await expect(menu).not.toBeVisible();
  // Choosing the same wallet again finishes the choice and closes the chooser.
  await chooser
    .getByRole("button", { name: "Connect UniSat", exact: true })
    .click();
  await expect(chooser).not.toBeVisible();
  await expect(walletButton(page)).toContainText(wallet.address.slice(0, 6));
});

test("moving between pages keeps the wallet connected: the app is not loaded again and the button never flickers", async ({
  page,
}) => {
  // A slow wallet, so a page that started the app over would show the wait.
  await installFakeWallet(page, wallet, 1_500);
  await page.goto("/");
  await connectWallet(page, wallet);
  // Mark this page, and record every text the wallet button shows from now on.
  await page.evaluate(() => {
    Reflect.set(window, "stillThisPage", true);
    const seen: string[] = [];
    Reflect.set(window, "buttonTexts", seen);
    const note = () => {
      const text = document.querySelector(
        ".wallet-widget__trigger",
      )?.textContent;
      if (text !== undefined && text !== null) seen.push(text);
    };
    note();
    new MutationObserver(note).observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  });
  const bar = page.getByRole("navigation", { name: "Primary navigation" });
  await bar.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/u);
  await bar.getByRole("link", { name: "Collections", exact: true }).click();
  await expect(page).toHaveURL(/\/collections$/u);
  await page.getByRole("link", { name: "Adorbitals home" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/collections$/u);
  expect(await page.evaluate(() => Reflect.get(window, "stillThisPage"))).toBe(
    true,
  );
  const texts = await page.evaluate(() => Reflect.get(window, "buttonTexts"));
  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) expect(text).toContain(wallet.address.slice(0, 6));
  await expect(walletButton(page)).toContainText(wallet.address.slice(0, 6));
});

test("links that are not for the app to move between still behave as links", async ({
  page,
}) => {
  await page.goto("/");
  // Whether anything cancelled the click by the time it reached the window (the app cancels one it takes over).
  await page.evaluate(() => {
    window.addEventListener("click", (event) =>
      Reflect.set(window, "clickWasCancelled", event.defaultPrevented),
    );
  });
  const bar = page.getByRole("navigation", { name: "Primary navigation" });
  // A modified click is the browser's (a new tab): the app leaves it alone and this page does not move.
  await bar
    .getByRole("link", { name: "Games", exact: true })
    .click({ modifiers: ["ControlOrMeta"] });
  expect(
    await page.evaluate(() => Reflect.get(window, "clickWasCancelled")),
  ).toBe(false);
  await expect(page).toHaveURL(/\/$/u);
  // An ordinary click is taken over by the app, and the skip link still jumps within the page.
  await bar.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/u);
  expect(
    await page.evaluate(() => Reflect.get(window, "clickWasCancelled")),
  ).toBe(true);
  await page.getByRole("link", { name: "Skip to main content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/u);
});
