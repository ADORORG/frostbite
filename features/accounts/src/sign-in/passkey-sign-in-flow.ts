import {
  passkeyRoutes,
  passkeySignedInResponseSchema,
  passkeySignInBeginResponseSchema,
  type PasskeySignInBeginResponse,
} from "@ador/auth";
import { ApiError, type Requester } from "@ador/client-http";

// Why a passkey sign-in did not happen, in the person's terms. None of these says whether an account exists.
export type PasskeySignInResult =
  | { readonly kind: "signed-in" }
  | {
      readonly kind: "cancelled" | "network" | "not-verified" | "unsupported";
    };

// The two server steps around the browser's own prompt. The prompt (`ask`) and whether the browser has one (`supported`) are given, so
// this runs without a browser; the page gives the real ones.
export async function signInWithPasskey(dependencies: {
  readonly ask: (
    options: PasskeySignInBeginResponse["options"],
  ) => Promise<object>;
  readonly request: Requester;
  readonly supported: () => boolean;
}): Promise<PasskeySignInResult> {
  if (!dependencies.supported()) return { kind: "unsupported" };
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
    return { kind: "cancelled" };
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

function failureOf(error: unknown): PasskeySignInResult {
  return error instanceof ApiError && error.code === "network"
    ? { kind: "network" }
    : { kind: "not-verified" };
}
