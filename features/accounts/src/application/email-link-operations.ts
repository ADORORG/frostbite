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
  type EmailCodeRequest,
  type EmailCodeVerify,
} from "@ador/auth";
import type { HttpOperation } from "@ador/http";
import { failure, unauthenticated } from "@ador/http/outcome";

import { emailTakenMessage } from "../email-conflict.ts";
import {
  codeNotVerified,
  codeRequestFailure,
} from "./email-request-results.ts";

type Changed = { readonly changed: true };

const recentAuthenticationRequired = failure(
  "forbidden",
  "Recent authentication is required. Sign in again, then retry.",
);
// The answer for an address another account holds: that it is another account's, never whose. It is given only after the code has proved
// the caller controls the mailbox.
const cannotUseAddress = failure("conflict", emailTakenMessage);

// The email steps of a person who is already signed in: seeing the account's addresses, asking for a code to add one, entering it, and
// removing one. Every one acts on the session's own account, never on one the request names.
export function createEmailLinkOperations(
  getService: () => Pick<
    ContactLinkService,
    "confirm" | "list" | "request" | "unlink"
  >,
) {
  const addresses: HttpOperation<
    Record<string, never>,
    { readonly addresses: readonly string[] }
  > = {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (_input, context) => {
      if (context.actorSession === null) return unauthenticated;
      return {
        ok: true,
        value: {
          addresses: await getService().list(
            context.actorSession.userId,
            emailMethodKind,
          ),
        },
      };
    },
    idempotency: "none",
    input: "none",
    inputSchema: emailEmptyInputSchema,
    outputSchema: emailAddressesResponseSchema,
    ...emailCodeRoutes.addresses,
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
        return result.reason === "recent-authentication-required"
          ? recentAuthenticationRequired
          : codeRequestFailure(result);
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
          return failure(
            "conflict",
            "This is your only way to sign in. Add another one first.",
          );
        case "missing":
          return failure("not_found", "That address is not on this account.");
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
