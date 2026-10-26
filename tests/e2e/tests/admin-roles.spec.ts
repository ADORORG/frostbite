import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import {
  authSessions,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@ador/database";
import { eq } from "drizzle-orm";

import { creatorE2EFixtures, seededEmails } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";

// The administrator's role screen against a real server and database, as the seeded administrator. The person to give a role to signs in by
// email only, so a role given to them is recorded but cannot work until they hold a wallet.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const lampOf = (page: Page) => page.locator("p[role=status]");

// Changing roles needs a recent sign-in, and the seeded session was made when the run began, which may be a while ago: sign in again.
async function signInAgain(token: string) {
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

async function asAdmin(page: Page, baseURL: string | undefined) {
  const { sessionToken } = creatorE2EFixtures.admin;
  await signInAgain(sessionToken);
  await useE2ESession(page.context(), baseURL ?? "", sessionToken);
}

test("the administrator sees who holds roles, with each role's state", async ({
  baseURL,
  page,
}) => {
  await asAdmin(page, baseURL);
  await page.goto("/admin/roles");
  await expect(
    page.getByRole("heading", { name: "Platform roles" }),
  ).toBeVisible();
  const people = page.getByRole("list", { name: "People with roles" });
  // The administrator and the staff member each hold a wallet, so their roles work; people are named by the wallet they hold.
  await expect(
    people.getByRole("list", { name: "Roles of tb1qe2…dmin" }),
  ).toContainText("admin (manages who holds roles): active");
  await expect(
    people.getByRole("list", { name: "Roles of tb1qe2…taff" }),
  ).toContainText("staff (operates the platform): active");
  // The header's Admin link goes to the first admin area this person may open: an administrator may open the overview, like staff.
  await expect(
    page.getByLabel("Primary navigation").getByRole("link", { name: "Admin" }),
  ).toHaveAttribute("href", "/admin");
});

test("an administrator finds a person by email, gives them a role that cannot work yet, and takes it away again", async ({
  baseURL,
  page,
}) => {
  await asAdmin(page, baseURL);
  await page.goto("/admin/roles");
  await page
    .getByLabel("Email, wallet address or account id")
    .fill(seededEmails.roleCandidate.toUpperCase());
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(
    lampOf(page).filter({ hasText: "One account matches" }),
  ).toBeVisible();
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results).toContainText(seededEmails.roleCandidate);

  await results
    .getByRole("button", {
      name: `Grant staff for ${seededEmails.roleCandidate}`,
    })
    .click();
  await expect(lampOf(page).filter({ hasText: "staff granted" })).toContainText(
    "recorded but does not work yet",
  );
  const roles = results.getByRole("list", {
    name: `Roles of ${seededEmails.roleCandidate}`,
  });
  await expect(roles).toContainText(
    "staff (operates the platform): active, not working yet",
  );
  // The list the server now has shows them too, and reloading keeps it.
  await page.reload();
  await expect(
    page.getByRole("list", { name: "People with roles" }),
  ).toContainText(seededEmails.roleCandidate);

  await page
    .getByRole("list", { name: "People with roles" })
    .getByRole("button", {
      name: `Suspend staff for ${seededEmails.roleCandidate}`,
    })
    .click();
  await expect(
    lampOf(page).filter({ hasText: "staff suspended" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: `Roles of ${seededEmails.roleCandidate}` }),
  ).toContainText("staff (operates the platform): suspended");
});

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

test("a staff member who is not an administrator cannot open the screen or use its routes", async ({
  baseURL,
  page,
}) => {
  await useE2ESession(
    page.context(),
    baseURL ?? "",
    creatorE2EFixtures.staff.sessionToken,
  );
  await page.goto("/admin/roles");
  await expect(
    page.getByRole("heading", { name: "Platform roles" }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/v1/admin/roles")).status()).toBe(403);
});
