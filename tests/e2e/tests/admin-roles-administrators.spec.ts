import { expect, test, type Page } from "@playwright/test";
import { testWallets } from "@frostbite/auth/test-fixtures";
import {
  authSessions,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  platformRoleAssignments,
  walletIdentities,
} from "@frostbite/database";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { and, eq } from "drizzle-orm";

import { seededEmails } from "../src/creator-fixtures.ts";
import { asAdmin } from "./support/admin-session.ts";
import { installFakeWallet, signInWithWallet } from "./support/fake-wallet.ts";

// Tests that depend on HOW MANY administrators there are. They share one database with every other spec, and files run in parallel, so they
// live in one file and run one after the other: the last-administrator rule is checked while the seeded administrator is the only one, and the
// second administrator the sign-in test makes is taken away again before anything else can see it.
test.describe.configure({ mode: "serial" });

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

// Takes the second administrator's role away, so the seeded one is the only administrator again.
async function removeAdministrator(address: string) {
  const pool = createDatabasePool(parseDatabaseEnvironment(process.env));
  try {
    const database = createDatabaseClient(pool);
    const [identity] = await database
      .select({ userId: walletIdentities.userId })
      .from(walletIdentities)
      .where(eq(walletIdentities.address, address));
    if (identity === undefined) return;
    await database
      .delete(platformRoleAssignments)
      .where(
        and(
          eq(platformRoleAssignments.userId, identity.userId),
          eq(platformRoleAssignments.role, "admin"),
        ),
      );
  } finally {
    await pool.end();
  }
}

test("nothing is found for an address nobody has, and the last administrator cannot suspend themselves", async ({
  baseURL,
  page,
}) => {
  await asAdmin(page, baseURL);
  await page.goto("/admin/roles");
  await page
    .getByLabel("Email, wallet address or account id")
    .fill("nobody-here@example.test");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(
    lampOf(page).filter({ hasText: "Nobody has that address" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Suspend admin for tb1qe2…dmin" })
    .click();
  await expect(
    lampOf(page).filter({ hasText: "last working administrator" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Roles of tb1qe2…dmin" }),
  ).toContainText("admin (manages who holds roles): active");
});

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

test.afterAll(async () => {
  await removeAdministrator(wallet.address);
});
