import type { DatabaseTransaction } from "@ador/database/connection";
import { walletIdentities } from "@ador/database/schema/auth";
import { eq } from "drizzle-orm";

import type { MethodAdapter } from "../methods/contracts.ts";

export const walletMethodKind = "wallet";

// A Bitcoin wallet: signs in, and is strong (a signature over a challenge bound to this site).
export const walletMethod: MethodAdapter<DatabaseTransaction> = {
  assurance: "strong",
  canSignIn: true,
  kind: walletMethodKind,
  list: async (transaction, userId) =>
    (
      await transaction
        .select({ id: walletIdentities.id })
        .from(walletIdentities)
        .where(eq(walletIdentities.userId, userId))
    ).map(({ id }) => id),
};
