// The link repository over a real database, and the helpers the link and unlink tests share.
import { contactIdentities } from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { expect } from "vitest";

import { createDrizzleContactLinkRepository } from "../../src/contacts/drizzle-link-repository.ts";
import { emailMethod } from "../../src/contacts/method.ts";
import { createMethodRegistry } from "../../src/methods/registry.ts";
import { passkeyMethod } from "../../src/passkeys/method.ts";
import { walletMethod } from "../../src/wallets/method.ts";
import {
  clock,
  database,
  issueInput,
  repository,
  sessionMaterial,
  start,
} from "./contact-world.ts";

export const links = createDrizzleContactLinkRepository(
  database,
  createMethodRegistry([walletMethod, passkeyMethod, emailMethod]).list,
);
export const window = 600_000;

// A link code for the account, issued through the real repository so the limits and replacement apply.
export async function linkCode(
  userId: string,
  destination = "new@example.com",
  offsetMs = 0,
) {
  const input = issueInput({
    destination,
    issuedAt: new Date(start.getTime() + offsetMs),
    purpose: "link",
    userId,
  });
  expect(await repository.issue(input)).toEqual({ kind: "issued" });
  return input;
}
export function change(
  account: { sessionId: string; userId: string },
  destination = "new@example.com",
  now = clock.now,
) {
  return {
    correlationId: createUuidV7(),
    destination,
    kind: "email",
    minimumAuthenticatedAt: new Date(now.getTime() - window),
    now,
    replacementSession: sessionMaterial(),
    sessionId: account.sessionId,
    userId: account.userId,
  };
}
export const identities = () => database.select().from(contactIdentities);
