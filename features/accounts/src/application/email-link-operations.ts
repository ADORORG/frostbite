import {
  emailAddressesResponseSchema,
  emailCodeRequestResponseSchema,
  emailCodeRequestSchema,
  emailCodeRoutes,
  emailCodeVerifySchema,
  emailEmptyInputSchema,
  emailLinkedResponseSchema,
  emailMethodKind,
  type ContactLinkService,
  type EmailAddressesView,
  type EmailCodeRequest,
  type EmailCodeVerify,
} from "@frostbite/auth";
import type { HttpOperation } from "@frostbite/http";
import { unauthenticated } from "@frostbite/http/outcome";

import { emailAddressesView } from "./email-addresses-view.ts";
import { outcomeFailure } from "./outcomes.ts";
import {
  codeNotVerified,
  codeRequestFailure,
} from "./email-request-results.ts";

type Changed = { readonly changed: true };

const recentAuthenticationRequired = outcomeFailure(
  "recent-authentication-required",
);
// The answer for an address another account holds: that it is another account's, never whose. It is given only after the code has proved
// the caller controls the mailbox.
const cannotUseAddress = outcomeFailure("email-taken");
const addressLimitReached = outcomeFailure("email-limit-reached");

// The email steps of a person who is already signed in: seeing the account's addresses, asking for a code to add one, entering it, and
// removing one. Every one acts on the session's own account, never on one the request names.
export function createEmailLinkOperations(
  getService: () => Pick<
    ContactLinkService,
    "addresses" | "confirm" | "request" | "unlink"
  >,
) {
  const addresses: HttpOperation<Record<string, never>, EmailAddressesView> = {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (_input, context) => {
      if (context.actorSession === null) return unauthenticated;
      return {
        ok: true,
        value: await emailAddressesView(
          getService(),
          context.actorSession.userId,
        ),
      };
    },
    idempotency: "none",
    input: "none",
    inputSchema: emailEmptyInputSchema,
    outputSchema: emailAddressesResponseSchema,
    ...emailCodeRoutes.addresses,
    cache: { kind: "revalidate" },
  };
  const linkRequest: HttpOperation<EmailCodeRequest, { readonly sent: true }> =
    {
      access: { kind: "authenticated" },
      applicationErrors: [
        "conflict",
        "forbidden",
        "invalid_request",
        "not_found",
        "unauthorized",
      ],
      execute: async (input, context) => {
        if (context.actorSession === null) return unauthenticated;
        const result = await getService().request({
          destination: input.email,
          kind: emailMethodKind,
          session: context.actorSession,
        });
        if (result.ok) return { ok: true, value: { sent: true } };
        if (result.reason === "recent-authentication-required")
          return recentAuthenticationRequired;
        if (result.reason === "limit-reached") return addressLimitReached;
        return codeRequestFailure(result);
      },
      idempotency: "none",
      input: "json",
      inputSchema: emailCodeRequestSchema,
      outputSchema: emailCodeRequestResponseSchema,
      ...emailCodeRoutes.linkRequest,
    };
  const linkVerify: HttpOperation<EmailCodeVerify, Changed> = {
    access: { kind: "authenticated" },
    applicationErrors: ["conflict", "forbidden", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorSession === null) return unauthenticated;
      const result = await getService().confirm({
        code: input.code,
        correlationId: context.correlationId,
        destination: input.email,
        kind: emailMethodKind,
        session: context.actorSession,
      });
      if (result.ok)
        return {
          // No new session when the account already held the address: nothing changed.
          effects:
            result.sessionToken === null
              ? []
              : [
                  {
                    kind: "replace-platform-session",
                    token: result.sessionToken,
                  },
                ],
          ok: true,
          value: { changed: true },
        };
      switch (result.reason) {
        case "taken":
          return cannotUseAddress;
        case "limit-reached":
          return addressLimitReached;
        case "recent-authentication-required":
          return recentAuthenticationRequired;
        case "invalid":
          return codeNotVerified;
      }
    },
    idempotency: "none",
    input: "json",
    inputSchema: emailCodeVerifySchema,
    outputSchema: emailLinkedResponseSchema,
    ...emailCodeRoutes.linkVerify,
  };
  const unlink: HttpOperation<EmailCodeRequest, Changed> = {
    access: { kind: "authenticated" },
    applicationErrors: ["conflict", "forbidden", "not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorSession === null) return unauthenticated;
      const result = await getService().unlink({
        correlationId: context.correlationId,
        destination: input.email,
        kind: emailMethodKind,
        session: context.actorSession,
      });
      if (result.ok)
        return {
          effects: [
            { kind: "replace-platform-session", token: result.sessionToken },
          ],
          ok: true,
          value: { changed: true },
        };
      switch (result.reason) {
        case "final-method":
          return outcomeFailure("last-sign-in-method");
        case "missing":
          return outcomeFailure("email-missing");
        case "recent-authentication-required":
          return recentAuthenticationRequired;
      }
    },
    idempotency: "none",
    input: "json",
    inputSchema: emailCodeRequestSchema,
    outputSchema: emailLinkedResponseSchema,
    ...emailCodeRoutes.unlink,
  };
  return [addresses, linkRequest, linkVerify, unlink] as const;
}
