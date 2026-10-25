import {
  emailAddressesResponseSchema,
  emailCodeRequestResponseSchema,
  emailCodeRoutes,
  emailLinkedResponseSchema,
} from "@ador/auth";
import { ApiError, type Requester } from "@ador/client-http";

// What happened when a signed-in person changed their email addresses, in their terms. `recent-authentication` means the session is too
// old to change sign-in methods and the person must sign in again; the others are told as they are.
export type RequestLinkOutcome =
  | { readonly kind: "sent" }
  | {
      readonly kind:
        | "invalid-email"
        | "network"
        | "recent-authentication"
        | "signed-out"
        | "unavailable";
    }
  // The server's own words: it knows how long the person has to wait.
  | { readonly kind: "refused"; readonly message: string };

export type ConfirmLinkOutcome = {
  readonly kind:
    | "linked"
    | "network"
    | "recent-authentication"
    | "signed-out"
    | "taken"
    | "wrong-code";
};

export type RemoveOutcome = {
  readonly kind:
    | "final-method"
    | "missing"
    | "network"
    | "recent-authentication"
    | "removed"
    | "signed-out";
};

function failureOf(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  throw error;
}

export async function listEmailAddresses(
  request: Requester,
): Promise<readonly string[]> {
  return (
    await request(emailCodeRoutes.addresses, emailAddressesResponseSchema)
  ).addresses;
}

export async function requestLinkCode(
  request: Requester,
  email: string,
): Promise<RequestLinkOutcome> {
  try {
    await request(emailCodeRoutes.linkRequest, emailCodeRequestResponseSchema, {
      body: { email },
    });
    return { kind: "sent" };
  } catch (error) {
    const failed = failureOf(error);
    switch (failed.code) {
      case "forbidden":
        return { kind: "recent-authentication" };
      case "unauthorized":
        return { kind: "signed-out" };
      case "invalid_request":
        return { kind: "invalid-email" };
      case "not_found":
        return { kind: "unavailable" };
      case "conflict":
        return { kind: "refused", message: failed.message };
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

export async function confirmLinkCode(
  request: Requester,
  email: string,
  code: string,
): Promise<ConfirmLinkOutcome> {
  try {
    await request(emailCodeRoutes.linkVerify, emailLinkedResponseSchema, {
      body: { code, email },
    });
    return { kind: "linked" };
  } catch (error) {
    switch (failureOf(error).code) {
      case "forbidden":
        return { kind: "recent-authentication" };
      case "conflict":
        return { kind: "taken" };
      case "network":
      case "internal_error":
      case "invalid-response":
        return { kind: "network" };
      case "rate_limited":
      case "unauthorized":
        return { kind: "wrong-code" };
      default:
        return { kind: "signed-out" };
    }
  }
}

export async function removeEmailAddress(
  request: Requester,
  email: string,
): Promise<RemoveOutcome> {
  try {
    await request(emailCodeRoutes.unlink, emailLinkedResponseSchema, {
      body: { email },
    });
    return { kind: "removed" };
  } catch (error) {
    switch (failureOf(error).code) {
      case "forbidden":
        return { kind: "recent-authentication" };
      case "conflict":
        return { kind: "final-method" };
      case "not_found":
        return { kind: "missing" };
      case "unauthorized":
        return { kind: "signed-out" };
      default:
        return { kind: "network" };
    }
  }
}
