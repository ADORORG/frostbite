import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { testWallets } from "@frostbite/auth/test-fixtures";
import {
  authSessions,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database";
import { eq } from "drizzle-orm";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";
import { installFakeWallet, signInWithWallet } from "./support/fake-wallet.ts";

// ROLE-1: an administrator finds a person by the wallet address they sign in with, and gives them a role that works at once (the person
// holds the wallet the role needs).
const wallet = testWallets[12];
const lampOf = (page: Page) => page.locator("p[role=status]");

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function freshSignIn(token: string) {
  const pool = createDatabasePool(parseDatabaseEnvironment(process.env));
  try {
    await createDatabaseClient(pool)
      .update(authSessions)
      .set({ authenticatedAt: new Date(), revokedAt: null })
      .where(
        eq(
          authSessions.tokenHash,
          createHash("sha256").update(token).digest("hex"),
        ),
      );
  } finally {
    await pool.end();
  }
}

test("an administrator finds a person by wallet address and gives them a role that works", async ({
  baseURL,
  browser,
  page,
}) => {
  // The person signs in once with their wallet, in a browser of their own, so the account exists.
  const player = await browser.newContext();
  const playerPage = await player.newPage();
  await installFakeWallet(playerPage, wallet);
  await signInWithWallet(playerPage, wallet);
  await player.close();

  const { sessionToken } = creatorE2EFixtures.admin;
  await freshSignIn(sessionToken);
  await useE2ESession(page.context(), baseURL ?? "", sessionToken);
  await page.goto("/admin/roles");
  await page
    .getByLabel("Email, wallet address or account id")
    .fill(wallet.address);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(
    lampOf(page).filter({ hasText: "One account matches" }),
  ).toBeVisible();
  const results = page.getByRole("list", { name: "Search results" });
  const short = `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`;
  await results
    .getByRole("button", { name: `Grant reviewer for ${short}` })
    .click();
  await expect(
    lampOf(page).filter({ hasText: "reviewer granted" }),
  ).toBeVisible();
  await expect(lampOf(page)).not.toContainText("does not work yet");
  await expect(
    results.getByRole("list", { name: `Roles of ${short}` }),
  ).toContainText("reviewer (decides on submissions and applications): active");
});
