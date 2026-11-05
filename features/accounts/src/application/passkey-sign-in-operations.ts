import {
  passkeyEmptyInputSchema,
  passkeyRoutes,
  passkeySignedInResponseSchema,
  passkeySignInBeginResponseSchema,
  passkeySignInFinishInputSchema,
  type PasskeySignInBeginResponse,
  type PasskeySignInFinishInput,
  type PasskeySignInService,
} from "@frostbite/auth";
import type { HttpOperation } from "@frostbite/http";
import { outcomeFailure } from "./outcomes.ts";
import { uuidV7Schema } from "@frostbite/shared/identifiers";

// One answer for every way a passkey sign-in can fail (unknown or spent challenge, unknown credential, bad signature, a counter that
// went backwards), so the response teaches a caller nothing about which accounts or credentials exist.
const notVerified = outcomeFailure("passkey-not-verified");

// Signing in with a passkey. Both steps are open to anyone, because there is no session yet; the second one starts it, and its
// token reaches the browser only as a cookie.
export function createPasskeySignInOperations(
  getService: () => PasskeySignInService,
) {
  const begin: HttpOperation<
    Record<string, never>,
    PasskeySignInBeginResponse
  > = {
    access: { kind: "public" },
    applicationErrors: [],
    execute: async () => {
      const begun = await getService().begin();
      return {
        ok: true,
        value: {
          challengeId: begun.challengeId,
          expiresAt: begun.expiresAt.toISOString(),
          options: begun.options,
        },
      };
    },
    idempotency: "none",
    input: "json",
    inputSchema: passkeyEmptyInputSchema,
    outputSchema: passkeySignInBeginResponseSchema,
    ...passkeyRoutes.beginSignIn,
  };
  const finish: HttpOperation<
    PasskeySignInFinishInput,
    { readonly signedIn: true }
  > = {
    access: { kind: "public" },
    applicationErrors: ["unauthorized"],
    execute: async (input) => {
      const result = await getService().finish({
        challengeId: uuidV7Schema.parse(input.challengeId),
        payload: input.credential,
      });
      return result.ok
        ? {
            effects: [
              { kind: "replace-platform-session", token: result.sessionToken },
            ],
            ok: true,
            value: { signedIn: true },
          }
        : notVerified;
    },
    idempotency: "none",
    input: "json",
    inputSchema: passkeySignInFinishInputSchema,
    outputSchema: passkeySignedInResponseSchema,
    ...passkeyRoutes.finishSignIn,
  };
  return [begin, finish] as const;
}
