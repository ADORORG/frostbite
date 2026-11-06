import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import {
  authSessions,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  walletIdentities,
} from "@frostbite/database";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { eq } from "drizzle-orm";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";

// ROLE-1: a person whose account has a wallet linked, and who is not signed in at all (no session exists for them), is found by that wallet's
// address and given a role that works at once: the role needs a wallet and the account holds one.
const linked = {
  address: "tb1qlinkednotsignedin00000000000000000000",
  scriptIdentity: "0014linkednotsignedin",
};
const lampOf = (page: Page) => page.locator("p[role=status]");

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function seedLinkedAccount(): Promise<string> {
  const pool = createDatabasePool(parseDatabaseEnvironment(process.env));
  try {
    const database = createDatabaseClient(pool);
    const userId = createUuidV7();
    await database.insert(authUsers).values({
      email: `contact-${userId}@contact.invalid`,
      emailVerified: true,
      id: userId,
      name: "E2E linked wallet",
    });
    await database.insert(walletIdentities).values({
      address: linked.address,
      id: createUuidV7(),
      network: "signet",
      scriptIdentity: linked.scriptIdentity,
      userId,
      walletAdapter: "e2e-fixture",
    });
    const sessions = await database
      .select({ id: authSessions.id })
      .from(authSessions)
      .where(eq(authSessions.userId, userId));
    expect(sessions).toHaveLength(0);
    // The administrator's sign-in must be recent for the change.
    await database
      .update(authSessions)
      .set({ authenticatedAt: new Date(), revokedAt: null })
      .where(
        eq(
          authSessions.tokenHash,
          createHash("sha256")
            .update(creatorE2EFixtures.admin.sessionToken)
            .digest("hex"),
        ),
      );
    return userId;
  } finally {
    await pool.end();
  }
}

test("an administrator finds an account by its linked wallet, which is not signed in, and gives it a role that works", async ({
  baseURL,
  page,
}) => {
  await seedLinkedAccount();
  await useE2ESession(
    page.context(),
    baseURL ?? "",
    creatorE2EFixtures.admin.sessionToken,
  );
  await page.goto("/admin/roles");
  await page
    .getByLabel("Email, wallet address or account id")
    .fill(linked.address);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(
    lampOf(page).filter({ hasText: "One account matches" }),
  ).toBeVisible();
  const results = page.getByRole("list", { name: "Search results" });
  const short = `${linked.address.slice(0, 6)}…${linked.address.slice(-4)}`;
  await results
    .getByRole("button", { name: `Grant staff for ${short}` })
    .click();
  await expect(lampOf(page).filter({ hasText: "staff granted" })).toBeVisible();
  await expect(lampOf(page)).not.toContainText("does not work yet");
  await expect(
    results.getByRole("list", { name: `Roles of ${short}` }),
  ).toContainText("staff (operates the platform): active");
  await expect(
    results.getByRole("list", { name: `Roles of ${short}` }),
  ).not.toContainText("not working yet");
});
