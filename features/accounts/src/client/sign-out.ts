import {
  walletAuthRoutes,
  walletChangedResponseSchema,
  walletEmptyRequestSchema,
} from "@frostbite/auth";
import type { Requester } from "@frostbite/client-http";
import type { AccountOutcome } from "@frostbite/shared/account-outcomes";

import { outcomeOf } from "./outcome.ts";

// Ends the signed-in session. Signing out is the one thing the header does about the session (signing in is the sign-in page's, and
// managing methods the account page's), so it is a request of its own and not a store. Resolves to nothing when the server did it, or to
// the outcome that says why not.
export async function signOut(
  request: Requester,
): Promise<AccountOutcome | null> {
  try {
    await request(walletAuthRoutes.signOut, walletChangedResponseSchema, {
      body: walletEmptyRequestSchema.parse({}),
    });
    return null;
  } catch (error) {
    return outcomeOf(error);
  }
}
