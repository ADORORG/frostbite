import {
  passkeyRoutes,
  passkeySignedInResponseSchema,
  passkeySignInBeginResponseSchema,
  type PasskeySignInBeginResponse,
} from "@ador/auth";
import type { Requester } from "@ador/client-http";

import { failed, failedFrom, type Failed } from "../client/outcome.ts";

// Why a passkey sign-in did not happen, from the catalogue of outcomes. None of these says whether an account exists.
export type PasskeySignInResult = { readonly kind: "signed-in" } | Failed;

// The two server steps around the browser's own prompt. The prompt (`ask`) and whether the browser has one (`supported`) are given, so
// this runs without a browser; the page gives the real ones.
export async function signInWithPasskey(dependencies: {
  readonly ask: (
    options: PasskeySignInBeginResponse["options"],
  ) => Promise<object>;
  readonly request: Requester;
  readonly supported: () => boolean;
}): Promise<PasskeySignInResult> {
  if (!dependencies.supported()) return failed("passkey-unsupported");
  let begun: PasskeySignInBeginResponse;
  try {
    begun = await dependencies.request(
      passkeyRoutes.beginSignIn,
      passkeySignInBeginResponseSchema,
      { body: {} },
    );
  } catch (error) {
    return failureOf(error);
  }
  let credential: object;
  try {
    credential = await dependencies.ask(begun.options);
  } catch {
    // The person closed the prompt, or the authenticator had nothing for this site.
    return failed("passkey-cancelled");
  }
  try {
    await dependencies.request(
      passkeyRoutes.finishSignIn,
      passkeySignedInResponseSchema,
      { body: { challengeId: begun.challengeId, credential } },
    );
    return { kind: "signed-in" };
  } catch (error) {
    return failureOf(error);
  }
}

// Anything the server did not name as something else is a passkey that could not be verified: that is all this ceremony can fail on.
function failureOf(error: unknown): PasskeySignInResult {
  return failedFrom(error, "passkey-not-verified");
}
