import type { DatabaseTransaction } from "@ador/database/connection";
import {
  passkeyCredentials,
  walletIdentities,
} from "@ador/database/schema/auth";
import { eq } from "drizzle-orm";

import type { AccountMethod } from "./rule.ts";

// Every sign-in method an account has right now, read inside the caller's transaction so the decision to remove
// one is made on what is there, under the caller's lock. Wallets can sign in; passkeys cannot (yet). An email
// method will be listed here when that adapter exists.
export async function listAccountMethods(
  transaction: DatabaseTransaction,
  userId: string,
): Promise<readonly AccountMethod[]> {
  const [wallets, passkeys] = await Promise.all([
    transaction
      .select({ id: walletIdentities.id })
      .from(walletIdentities)
      .where(eq(walletIdentities.userId, userId)),
    transaction
      .select({ id: passkeyCredentials.credentialId })
      .from(passkeyCredentials)
      .where(eq(passkeyCredentials.userId, userId)),
  ]);
  return [
    ...wallets.map(({ id }) => ({
      canSignIn: true,
      id,
      kind: "wallet" as const,
    })),
    ...passkeys.map(({ id }) => ({
      canSignIn: false,
      id,
      kind: "passkey" as const,
    })),
  ];
}
