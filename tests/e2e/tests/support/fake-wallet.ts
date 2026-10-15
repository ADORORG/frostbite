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
export async function installFakeWallet(page: Page, wallet: TestWallet) {
  await page.exposeFunction("walletSign", (message: string, scheme: string) => {
    expect(scheme).toBe("bip322-simple");
    return signAs(wallet, message);
  });
  await page.addInitScript(
    ({ address }) => {
      Object.defineProperty(window, "unisat", {
        value: {
          getAccounts: async () => [address],
          getBalance: async () => ({ confirmed: 0, total: 0, unconfirmed: 0 }),
          getChain: async () => ({ enum: "BITCOIN_SIGNET" }),
          getPublicKey: async () => "02" + "11".repeat(32),
          on: () => undefined,
          removeListener: () => undefined,
          requestAccounts: async () => [address],
          signMessage: (message: string, scheme: string) =>
            window.walletSign(message, scheme),
        },
      });
    },
    { address: wallet.address },
  );
}

// Opens the chooser on the sign-in page and connects the (fake) UniSat, as a player does.
export async function connectWallet(page: Page) {
  await page
    .getByRole("button", { name: "Choose wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Connect UniSat", exact: true })
    .click();
  await expect(page.getByText("Connected to unisat on signet")).toBeVisible();
}
