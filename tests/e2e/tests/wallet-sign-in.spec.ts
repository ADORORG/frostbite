import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { platformSessionCookieName } from "@ador/shared/auth";

import { authMethodsResponseSchema } from "@ador/auth";
import {
  testWallets,
  signAs,
} from "../../../packages/auth/test/support/fixtures.ts";
import {
  connectWallet,
  installFakeWallet,
  openWalletMenu,
  walletButton,
  walletMenu,
  type TestWallet,
} from "./support/fake-wallet.ts";

// Signing in with a wallet through the header widget, the real challenge and the real verifier, against a real server
// and database. Each test has wallets of its own, because accounts persist for the whole run.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const [w0, w1, w2, w3, w4, w5, w6, w7] = testWallets;
const origin = (baseURL: string | undefined) => new URL(baseURL ?? "").origin;
const methodsOf = async (page: Page) => {
  const response = await page.request.get("/api/v1/auth/methods");
  return {
    body: response.ok()
      ? authMethodsResponseSchema.parse(await response.json())
      : null,
    status: response.status(),
  };
};

async function openApp(
  browser: Browser,
  baseURL: string | undefined,
  wallet: TestWallet,
  context?: BrowserContext,
) {
  const ctx = context ?? (await browser.newContext({ baseURL }));
  const page = await ctx.newPage();
  await installFakeWallet(page, wallet);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  return { ctx, page };
}
async function signInWith(
  browser: Browser,
  baseURL: string | undefined,
  wallet: TestWallet,
) {
  const opened = await openApp(browser, baseURL, wallet);
  await connectWallet(opened.page, wallet);
  await openWalletMenu(opened.page);
  await walletMenu(opened.page)
    .getByRole("button", { name: "Sign in with wallet" })
    .click();
  await expect(walletMenu(opened.page)).toContainText(
    "Signed in with this wallet.",
  );
  return opened;
}

test("a player signs in with a wallet, stays signed in across a reload, and signs out", async ({
  baseURL,
  browser,
}) => {
  const { ctx, page } = await signInWith(browser, baseURL, w0);
  expect(
    (await methodsOf(page)).body?.wallets.map((wallet) => wallet.address),
  ).toEqual([w0.address]);
  // The session is a host-only, script-proof cookie; its token is not in the page.
  const cookie = (await ctx.cookies()).find(
    (c) => c.name === platformSessionCookieName,
  );
  expect(cookie).toMatchObject({ httpOnly: true, path: "/", sameSite: "Lax" });
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "ador-session",
  );
  // After a reload the session holds and the widget reconnects to the same wallet without being asked.
  await page.reload();
  expect((await methodsOf(page)).status).toBe(200);
  await expect(walletButton(page)).toContainText(w0.address.slice(0, 6));
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { exact: true, name: "Account" }),
  ).toBeVisible();
  await openWalletMenu(page);
  await walletMenu(page).getByRole("button", { name: "Sign out" }).click();
  await expect(walletMenu(page)).toContainText("Connected, not signed in.");
  expect((await methodsOf(page)).status).toBe(401);
  await ctx.close();
});

test("a wallet that belongs to another account is refused, and the refusal says so without saying whose it is", async ({
  baseURL,
  browser,
}) => {
  const other = await signInWith(browser, baseURL, w1);
  const mine = await signInWith(browser, baseURL, w2);
  // Another tab of the same browser reconnects to the wallet by itself (here, the one it now has).
  const second = await openApp(browser, baseURL, w1, mine.ctx);
  await expect(walletButton(second.page)).toContainText(w1.address.slice(0, 6));
  await openWalletMenu(second.page);
  await expect(walletMenu(second.page)).toContainText(
    "This wallet is not linked to your account",
  );
  await walletMenu(second.page)
    .getByRole("button", { name: "Link this wallet" })
    .click();
  await expect(walletMenu(second.page).getByRole("alert")).toHaveText(
    "This wallet is already linked to a different account. Sign in to that account and remove it there first, or use another wallet.",
  );
  expect(
    (await methodsOf(second.page)).body?.wallets.map(
      (wallet) => wallet.address,
    ),
  ).toEqual([w2.address]);
  await other.ctx.close();
  await mine.ctx.close();
});

test("a second wallet can be linked, removed, and while it is held no other account can take it", async ({
  baseURL,
  browser,
}) => {
  const mine = await signInWith(browser, baseURL, w3);
  const second = await openApp(browser, baseURL, w4, mine.ctx);
  await expect(walletButton(second.page)).toContainText(w4.address.slice(0, 6));
  await openWalletMenu(second.page);
  await walletMenu(second.page)
    .getByRole("button", { name: "Link this wallet" })
    .click();
  await expect(walletMenu(second.page)).toContainText(
    "Signed in with this wallet.",
  );
  expect((await methodsOf(second.page)).body?.wallets).toHaveLength(2);
  await walletMenu(second.page)
    .getByRole("button", {
      name: new RegExp(`^Remove ${w4.address.slice(0, 8)}`, "u"),
    })
    .click();
  await expect
    .poll(async () => (await methodsOf(second.page)).body?.wallets.length)
    .toBe(1);
  // Held: a new account cannot be started with it, and the refusal is the ordinary one.
  const stranger = await openApp(browser, baseURL, w4);
  await connectWallet(stranger.page, w4);
  await openWalletMenu(stranger.page);
  await walletMenu(stranger.page)
    .getByRole("button", { name: "Sign in with wallet" })
    .click();
  await expect(walletMenu(stranger.page).getByRole("alert")).toHaveText(
    "This wallet cannot be used for that.",
  );
  expect((await methodsOf(stranger.page)).status).toBe(401);
  // The account that removed it may take it back at once.
  await expect(walletMenu(second.page)).toContainText(
    "This wallet is not linked to your account",
  );
  await walletMenu(second.page)
    .getByRole("button", { name: "Link this wallet" })
    .click();
  await expect
    .poll(async () => (await methodsOf(second.page)).body?.wallets.length)
    .toBe(2);
  await stranger.ctx.close();
  await mine.ctx.close();
});

test("the only way in cannot be removed, in the page or by asking the server", async ({
  baseURL,
  browser,
}) => {
  const mine = await signInWith(browser, baseURL, w5);
  await expect(walletMenu(mine.page)).toContainText("only way to sign in");
  await expect(
    walletMenu(mine.page).getByRole("button", { name: /^Remove/u }),
  ).toHaveCount(0);
  const only = (await methodsOf(mine.page)).body?.wallets[0];
  const response = await mine.page.request.post("/api/v1/auth/wallet/unlink", {
    data: { walletId: only?.id },
    headers: { origin: origin(baseURL) },
  });
  expect(response.status()).toBe(409);
  expect((await methodsOf(mine.page)).body?.wallets).toHaveLength(1);
  await mine.ctx.close();
});

test("a challenge made for linking cannot be used to sign in", async ({
  baseURL,
  browser,
}) => {
  const mine = await signInWith(browser, baseURL, w6);
  const headers = { origin: origin(baseURL) };
  const issued = await mine.page.request.post(
    "/api/v1/auth/wallet/link/challenge",
    {
      data: { address: w7.address, network: "signet", walletAdapter: "unisat" },
      headers,
    },
  );
  expect(issued.status()).toBe(200);
  const challenge = (await issued.json()) as {
    challengeId: string;
    message: string;
  };
  // A fresh browser, no session, holding the right signature for that challenge.
  const stranger = await browser.newContext({ baseURL });
  const attempt = await stranger.request.post("/api/v1/auth/wallet/verify", {
    data: {
      challengeId: challenge.challengeId,
      signature: signAs(w7, challenge.message),
    },
    headers,
  });
  expect(attempt.status()).toBe(401);
  expect(attempt.headers()["set-cookie"]).toBeUndefined();
  await stranger.close();
  // The right caller can still finish it, so the refusal consumed nothing.
  const finished = await mine.page.request.post(
    "/api/v1/auth/wallet/link/verify",
    {
      data: {
        challengeId: challenge.challengeId,
        signature: signAs(w7, challenge.message),
      },
      headers,
    },
  );
  expect(finished.status()).toBe(200);
  await mine.ctx.close();
});
