import {
  emailCodeRequestResponseSchema,
  emailCodeRoutes,
  emailCodeSignedInResponseSchema,
} from "@ador/auth";
import { ApiError, type Requester } from "@ador/client-http";

// What happened when a code was asked for, in the person's terms. None of these says whether the address has an account.
export type RequestCodeOutcome =
  | { readonly kind: "sent" }
  | { readonly kind: "invalid-email" | "network" | "unavailable" }
  // The server's own words: it knows how long the person has to wait.
  | { readonly kind: "refused"; readonly message: string };

export type VerifyCodeOutcome =
  | { readonly kind: "signed-in" }
  | { readonly kind: "network" | "rate-limited" | "wrong-code" };

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
    if (!(error instanceof ApiError)) throw error;
    switch (error.code) {
      case "invalid_request":
        return { kind: "invalid-email" };
      case "not_found":
        return { kind: "unavailable" };
      case "conflict":
        return { kind: "refused", message: error.message };
      case "rate_limited":
        return {
          kind: "refused",
          message: "Too many requests. Wait a minute and try again.",
        };
      default:
        return { kind: "network" };
    }
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
    if (!(error instanceof ApiError)) throw error;
    switch (error.code) {
      case "rate_limited":
        return { kind: "rate-limited" };
      case "network":
      case "internal_error":
      case "invalid-response":
        return { kind: "network" };
      default:
        return { kind: "wrong-code" };
    }
  }
}
