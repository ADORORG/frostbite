import {
  passkeyBeginResponseSchema,
  passkeyListResponseSchema,
  passkeyMutationResponseSchema,
  passkeyRoutes,
  type PasskeyBeginResponse,
} from "@frostbite/auth";
import { ApiError, type Requester } from "@frostbite/client-http";

import { failed, failedFrom, type Failed } from "../client/outcome.ts";

// What happened when a signed-in person changed their passkeys: it worked (with the list as the server now has it), or why not, from the
// catalogue of outcomes. A change is reported only once the list has been read again, so a page never shows a list it cannot vouch for.
export type PasskeyChange =
  | {
      readonly kind: "linked" | "removed";
      readonly credentialIds: readonly string[];
    }
  | Failed;

export async function listPasskeys(
  request: Requester,
): Promise<readonly string[]> {
  return (await request(passkeyRoutes.list, passkeyListResponseSchema))
    .credentialIds;
}

// Anything the server did not name as something else is a change that could not be completed, which is all these steps can fail on.
const unconfirmed = "passkey-change-failed";

// Reads the list again after a change the server accepted. If that fails the change may have happened, so whatever the cause, the person
// is told the change could not be confirmed and to refresh, never that the server could not be reached.
async function changed(
  request: Requester,
  kind: "linked" | "removed",
): Promise<PasskeyChange> {
  try {
    return { credentialIds: await listPasskeys(request), kind };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return failed(unconfirmed);
  }
}

// The two server steps around the browser's own prompt. The prompt (`ask`) and whether the browser has one (`supported`) are given, so
// this runs without a browser; the page gives the real ones.
export async function linkPasskey(dependencies: {
  readonly ask: (options: PasskeyBeginResponse["options"]) => Promise<object>;
  readonly request: Requester;
  readonly supported: () => boolean;
}): Promise<PasskeyChange> {
  const { ask, request, supported } = dependencies;
  if (!supported()) return failed("passkey-unsupported");
  let begun: PasskeyBeginResponse;
  try {
    begun = await request(
      passkeyRoutes.beginRegistration,
      passkeyBeginResponseSchema,
      { body: {} },
    );
  } catch (error) {
    return failedFrom(error, unconfirmed);
  }
  let credential: object;
  try {
    credential = await ask(begun.options);
  } catch {
    // The person closed the prompt, or the authenticator would not make a passkey for this site.
    return failed("passkey-cancelled");
  }
  try {
    await request(
      passkeyRoutes.finishRegistration,
      passkeyMutationResponseSchema,
      { body: { challengeId: begun.challengeId, credential } },
    );
  } catch (error) {
    return failedFrom(error, unconfirmed);
  }
  return changed(request, "linked");
}

export async function removePasskey(
  request: Requester,
  credentialId: string,
): Promise<PasskeyChange> {
  try {
    await request(passkeyRoutes.unlink, passkeyMutationResponseSchema, {
      body: { credentialId },
    });
  } catch (error) {
    return failedFrom(error, unconfirmed);
  }
  return changed(request, "removed");
}
