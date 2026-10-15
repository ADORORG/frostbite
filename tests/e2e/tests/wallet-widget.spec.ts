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

test("shows the connected wallet, reconnects after a reload, and forgets it when disconnected", async ({
  page,
}) => {
  await installFakeWallet(page, wallet);
  await page.goto("/games");
  await connectWallet(page, wallet);
  await expect(walletButton(page).locator("svg.avatar")).toBeVisible();
  await page.reload();
  await expect(walletButton(page)).toContainText(wallet.address.slice(0, 8));
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
