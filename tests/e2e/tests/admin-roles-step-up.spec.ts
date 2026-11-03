import { expect, test, type Page } from "@playwright/test";
import { testWallets } from "@ador/auth/test-fixtures";
import {
  authSessions,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  platformRoleAssignments,
  walletIdentities,
} from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";

import { seededEmails } from "../src/creator-fixtures.ts";
import { installFakeWallet, signInWithWallet } from "./support/fake-wallet.ts";

// ROLE-1: an administrator whose last sign-in is older than the window is asked to sign in again before changing a role. The sign-in page
// used to take someone already signed in straight on, so there was no way to do what was asked and every change failed for good. The role
// screen now offers the wallet's own confirmation in place, and the change goes through once it is given.
const wallet = testWallets[11];
const lampOf = (page: Page) => page.locator("p[role=status]");

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

// Makes whoever holds the wallet an administrator, and their sign-in an hour old: the state of a real administrator who signed in earlier.
async function makeStaleAdministrator(address: string) {
  const pool = createDatabasePool(parseDatabaseEnvironment(process.env));
  try {
    const database = createDatabaseClient(pool);
    const [identity] = await database
      .select({ userId: walletIdentities.userId })
      .from(walletIdentities)
      .where(eq(walletIdentities.address, address));
    if (identity === undefined) throw new Error("The wallet has no account.");
    await database
      .insert(platformRoleAssignments)
      .values({
        id: createUuidV7(),
        role: "admin",
        status: "active",
        userId: identity.userId,
      })
      .onConflictDoNothing();
    await database
      .update(authSessions)
      .set({ authenticatedAt: new Date(Date.now() - 3_600_000) })
      .where(eq(authSessions.userId, identity.userId));
  } finally {
    await pool.end();
  }
}

test("an administrator with an old sign-in confirms with their wallet on the role screen and the change goes through", async ({
  page,
}) => {
  await installFakeWallet(page, wallet);
  await signInWithWallet(page, wallet);
  await makeStaleAdministrator(wallet.address);

  await page.goto("/admin/roles");
  await page
    .getByLabel("Email, wallet address or account id")
    .fill(seededEmails.roleCandidate);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  const results = page.getByRole("list", { name: "Search results" });
  await results
    .getByRole("button", {
      name: `Grant reviewer for ${seededEmails.roleCandidate}`,
    })
    .click();

  // Told why, with the way to put it right in the same place.
  await expect(
    lampOf(page).filter({ hasText: "sign in again before making this change" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign again to confirm" }).click();

  // The change that was asked for is made without asking for it again.
  await expect(
    lampOf(page).filter({ hasText: "reviewer granted" }),
  ).toBeVisible();
  await expect(
    results.getByRole("list", {
      name: `Roles of ${seededEmails.roleCandidate}`,
    }),
  ).toContainText("reviewer (decides on submissions and applications): active");
});
