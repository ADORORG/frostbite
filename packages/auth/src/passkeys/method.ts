import type { DatabaseTransaction } from "@frostbite/database/connection";
import { passkeyCredentials } from "@frostbite/database/schema/auth";
import { eq } from "drizzle-orm";

import type { MethodAdapter } from "../methods/contracts.ts";

export const passkeyMethodKind = "passkey";

// A passkey: strong, and it can start a session (the sign-in ceremony is `sign-in-service.ts`).
export const passkeyMethod: MethodAdapter<DatabaseTransaction> = {
  assurance: "strong",
  canSignIn: true,
  kind: passkeyMethodKind,
  list: async (transaction, userId) =>
    (
      await transaction
        .select({ id: passkeyCredentials.credentialId })
        .from(passkeyCredentials)
        .where(eq(passkeyCredentials.userId, userId))
    ).map(({ id }) => id),
};
