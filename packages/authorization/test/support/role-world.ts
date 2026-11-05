import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  platformRoleAssignments,
  platformRoleEvents,
  platformSetupLinks,
  walletIdentities,
} from "@frostbite/database";
import type { AuthorizationPolicy } from "@frostbite/shared/accounts";
import { createUuidV7, type UuidV7 } from "@frostbite/shared/identifiers";
import { and, eq } from "drizzle-orm";

// What the tests of platform roles and setup links share: a database, a policy in which staff and admin need a wallet, a stand-in for the
// sign-in method registry, and people with or without a wallet.

export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);

export const policy: AuthorizationPolicy = {
  organization: { admin: [], analyst: [], editor: [], owner: [] },
  platform: { admin: ["platform:manage-roles"], reviewer: [], staff: [] },
  requiredMethods: { admin: ["wallet"], staff: ["wallet"] },
  version: "test-v2",
};

// How long the method lookup takes. The lookup runs inside the role change's transaction, so a pause here holds a change open long
// enough for a second one to start beside it: that is how a test makes a race happen every time instead of when the timing allows.
export const lookup = { delayMs: 0 };

// A stand-in for the sign-in method registry: an account holds a wallet when it has a wallet identity.
export const heldKinds = async (
  context: Parameters<Parameters<typeof database.transaction>[0]>[0],
  userId: string,
) => {
  if (lookup.delayMs > 0)
    await new Promise((resolve) => setTimeout(resolve, lookup.delayMs));
  return new Set(
    (
      await context
        .select({ id: walletIdentities.id })
        .from(walletIdentities)
        .where(eq(walletIdentities.userId, userId))
    ).length > 0
      ? ["wallet"]
      : [],
  );
};

export const rules = {
  heldKinds,
  requiredMethods: policy.requiredMethods,
};

export async function person(withWallet: boolean): Promise<UuidV7> {
  const id = createUuidV7();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Person" });
  if (withWallet) await addWallet(id);
  return id;
}

export async function addWallet(userId: UuidV7): Promise<void> {
  await database.insert(walletIdentities).values({
    address: `tb1q${userId.replaceAll("-", "").slice(0, 30)}`,
    id: createUuidV7(),
    network: "signet",
    scriptIdentity: `script-${userId}`,
    userId,
    walletAdapter: "xverse",
  });
}

export async function admin(withWallet = true): Promise<UuidV7> {
  const id = await person(withWallet);
  await database
    .insert(platformRoleAssignments)
    .values({ id: createUuidV7(), role: "admin", userId: id });
  return id;
}

export const eventsFor = (target: UuidV7) =>
  database
    .select()
    .from(platformRoleEvents)
    .where(eq(platformRoleEvents.targetUserId, target));

export const status = async (user: UuidV7, role: "admin" | "staff") =>
  (
    await database
      .select()
      .from(platformRoleAssignments)
      .where(
        and(
          eq(platformRoleAssignments.userId, user),
          eq(platformRoleAssignments.role, role),
        ),
      )
  )[0]?.status ?? null;

// The audit tables refuse to lose evidence with a user, so a file that leaves rows behind would break the other files' own cleanup.
export async function clean(): Promise<void> {
  await database.delete(platformSetupLinks);
  await database.delete(platformRoleEvents);
  await database.delete(platformRoleAssignments);
  await database.delete(walletIdentities);
  await database.delete(authUsers);
}
