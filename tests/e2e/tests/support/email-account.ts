import { createHash, randomUUID } from "node:crypto";

import { expect, type BrowserContext, type Page } from "@playwright/test";
import {
  authSessions,
  authUsers,
  contactIdentities,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database";
import { readCapturedMail } from "@frostbite/mail";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { emailAddressesResponseSchema } from "@frostbite/auth";

import { useE2ESession } from "../../src/session.ts";

// The accounts and steps the email address specs share. The accounts are made directly in the database with a session of their own, so
// the specs spend none of the sign-in-by-email request limit that the sign-in spec uses.

export const unique = () => `${randomUUID().slice(0, 8)}@example.test`;
export const lampOf = (page: Page) => page.locator("p[role=status]");

// An account that holds `address`, with a session just signed in, as the browser's cookie.
export async function signedInAccount(
  context: BrowserContext,
  baseURL: string | undefined,
  address: string,
) {
  const pool = createDatabasePool(parseDatabaseEnvironment(process.env));
  const token = `e2e-email-link-${randomUUID()}`;
  const userId = createUuidV7();
  try {
    const database = createDatabaseClient(pool);
    const now = new Date();
    await database.insert(authUsers).values({
      email: `contact-${userId}@contact.invalid`,
      id: userId,
      name: "E2E email user",
    });
    await database.insert(contactIdentities).values({
      id: createUuidV7(),
      kind: "email",
      userId,
      value: address,
      verifiedAt: now,
    });
    await database.insert(authSessions).values({
      absoluteExpiresAt: new Date(now.getTime() + 86_400_000),
      authenticatedAt: now,
      id: createUuidV7(),
      idleExpiresAt: new Date(now.getTime() + 3_600_000),
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId,
    });
  } finally {
    await pool.end();
  }
  await useE2ESession(context, baseURL ?? "", token);
  return { userId };
}

// More addresses for an account, put straight into the database (each a minute after the one before): the way to fill an account up
// without a code for every one.
export async function holdAddresses(
  userId: string,
  addresses: readonly string[],
) {
  const pool = createDatabasePool(parseDatabaseEnvironment(process.env));
  try {
    const database = createDatabaseClient(pool);
    const first = Date.now() - 3_600_000;
    for (const [at, address] of addresses.entries())
      await database.insert(contactIdentities).values({
        createdAt: new Date(first + at * 60_000),
        id: createUuidV7(),
        kind: "email",
        userId,
        value: address,
        verifiedAt: new Date(first + at * 60_000),
      });
  } finally {
    await pool.end();
  }
}

export async function codeSentTo(address: string): Promise<string> {
  const directory = process.env.MAIL_CAPTURE_DIRECTORY;
  if (directory === undefined) throw new Error("The run has no mailbox.");
  let code: string | undefined;
  await expect
    .poll(async () => {
      const mail = (await readCapturedMail(directory)).find(
        ({ to }) => to === address,
      );
      code = /sign-in code is (\d{6})/u.exec(mail?.text ?? "")?.[1];
      return code;
    })
    .toBeDefined();
  if (code === undefined) throw new Error("No code arrived.");
  return code;
}

export async function addAddress(page: Page, address: string) {
  await page.getByLabel("Add an email address").fill(address);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByLabel(`Code sent to ${address}`)).toBeVisible();
  await page
    .getByLabel(`Code sent to ${address}`)
    .fill(await codeSentTo(address));
  await page.getByRole("button", { name: "Add address" }).click();
}

export const addressesOf = async (page: Page) =>
  emailAddressesResponseSchema.parse(
    await (await page.request.get("/api/v1/email/addresses")).json(),
  );

// Just the addresses, oldest first, as the list route gives them.
export const addressList = async (page: Page) =>
  (await addressesOf(page)).addresses.map(({ address }) => address);
