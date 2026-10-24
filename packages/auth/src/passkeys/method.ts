import type { DatabaseTransaction } from "@ador/database/connection";
import { passkeyCredentials } from "@ador/database/schema/auth";
import { eq } from "drizzle-orm";

import type { MethodAdapter } from "../methods/contracts.ts";

export const passkeyMethodKind = "passkey";

// A passkey: strong, and link-only until passkey sign-in is built (then `canSignIn` becomes true and nothing else changes).
export const passkeyMethod: MethodAdapter<DatabaseTransaction> = {
  assurance: "strong",
  canSignIn: false,
  kind: passkeyMethodKind,
  list: async (transaction, userId) =>
    (
      await transaction
        .select({ id: passkeyCredentials.credentialId })
        .from(passkeyCredentials)
        .where(eq(passkeyCredentials.userId, userId))
    ).map(({ id }) => id),
};
