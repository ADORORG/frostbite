import { expect, type Page } from "@playwright/test";

import { signAs } from "../../../../packages/auth/test/support/fixtures.ts";

declare global {
  interface Window {
    walletSign(message: string, scheme: string): Promise<string>;
  }
}

export interface TestWallet {
  readonly address: string;
  readonly privateKey: string;
}

// A deterministic stand-in for a wallet extension: the page sees a UniSat-shaped provider with this address, and
// every signature is made for real with this wallet's test key, then checked by the platform's real verifier. It
// is not evidence about any physical wallet, and no test signer is part of production code or bundles.
// `delayMs` makes the extension slow to answer, as a real one is, so a page that reconnects on load is seen waiting.
export async function installFakeWallet(
  page: Page,
  wallet: TestWallet,
  delayMs = 0,
) {
  await page.exposeFunction("walletSign", (message: string, scheme: string) => {
    expect(scheme).toBe("bip322-simple");
    return signAs(wallet, message);
  });
  await page.addInitScript(
    ({ address, delayMs: delay }) => {
      const later = <T>(value: T) =>
        new Promise<T>((resolve) => setTimeout(() => resolve(value), delay));
      Object.defineProperty(window, "unisat", {
        value: {
          getAccounts: () => later([address]),
          getBalance: async () => ({ confirmed: 0, total: 0, unconfirmed: 0 }),
          getChain: async () => ({ enum: "BITCOIN_SIGNET" }),
          getPublicKey: async () => "02" + "11".repeat(32),
          on: () => undefined,
          removeListener: () => undefined,
          requestAccounts: () => later([address]),
          signMessage: (message: string, scheme: string) =>
            window.walletSign(message, scheme),
        },
      });
    },
    { address: wallet.address, delayMs },
  );
}

// The wallet widget at the end of every page's header, and the menu it opens.
export const walletButton = (page: Page) =>
  page.locator(".wallet-widget__trigger");
export const walletMenu = (page: Page) =>
  page.getByRole("group", { name: "Wallet" });

// Opens the wallet chooser from the header and connects the (fake) UniSat, as a player does, and waits until the
// widget shows the connected wallet's address.
export async function connectWallet(page: Page, wallet: TestWallet) {
  await walletButton(page).click();
  await page
    .getByRole("button", { name: "Connect UniSat", exact: true })
    .click();
  await expect(walletButton(page)).toContainText(wallet.address.slice(0, 8));
}

// Opens the widget's menu if it is not open.
export async function openWalletMenu(page: Page) {
  if ((await walletButton(page).getAttribute("aria-expanded")) !== "true")
    await walletButton(page).click();
  await expect(walletMenu(page)).toBeVisible();
  return walletMenu(page);
}
