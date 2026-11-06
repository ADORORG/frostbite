import {
  emailCodeRequestResponseSchema,
  emailCodeRoutes,
  emailCodeSignedInResponseSchema,
} from "@frostbite/auth";
import type { Requester } from "@frostbite/client-http";

import { failed, failedFrom, type Failed } from "../client/outcome.ts";

// What happened when a code was asked for, or entered: it worked, or why not, from the catalogue of outcomes. None of these says whether
// the address has an account.
export type RequestCodeOutcome = { readonly kind: "sent" } | Failed;
export type VerifyCodeOutcome = { readonly kind: "signed-in" } | Failed;

export async function requestEmailCode(
  request: Requester,
  email: string,
): Promise<RequestCodeOutcome> {
  try {
    await request(emailCodeRoutes.request, emailCodeRequestResponseSchema, {
      body: { email },
    });
    return { kind: "sent" };
  } catch (error) {
    return failedFrom(error);
  }
}

export async function verifyEmailCode(
  request: Requester,
  email: string,
  code: string,
): Promise<VerifyCodeOutcome> {
  try {
    await request(emailCodeRoutes.verify, emailCodeSignedInResponseSchema, {
      body: { code, email },
    });
    return { kind: "signed-in" };
  } catch (error) {
    // Anything the server did not name as something else is a code that was not right: that is all this step can fail on. There is no
    // session yet to be signed out of, so an unnamed refusal is the same thing.
    const outcome = failedFrom(error, "code-wrong");
    return outcome.outcome === "signed-out" ? failed("code-wrong") : outcome;
  }
}
