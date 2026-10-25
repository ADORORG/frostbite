import {
  emailCodeRequestResponseSchema,
  emailCodeRequestSchema,
  emailCodeRoutes,
  emailCodeSignedInResponseSchema,
  emailCodeVerifySchema,
  emailMethodKind,
  type ContactCodeService,
  type EmailCodeRequest,
  type EmailCodeVerify,
} from "@ador/auth";
import type { HttpOperation } from "@ador/http";
import { failure } from "@ador/http/outcome";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

// How long to wait, in the person's terms, rounded up so "try again" is never too early.
function waitText(ms: number): string {
  const seconds = Math.ceil(ms / MS_PER_SECOND);
  if (seconds < SECONDS_PER_MINUTE)
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// One answer for every way entering a code can fail (wrong, expired, used, never sent, tries spent), so it teaches a caller nothing about
// which addresses have accounts or codes.
const notVerified = failure(
  "unauthorized",
  "That code is not right, or it has expired. Check it, or ask for a new one.",
);

// Signing in with an emailed code. Both steps are open to anyone, because there is no session yet; the second one starts it, and its
// token reaches the browser only as a cookie. Asking for a code answers the same whether or not the address has an account.
export function createEmailSignInOperations(
  getService: () => Pick<ContactCodeService, "request" | "verify">,
) {
  const request: HttpOperation<EmailCodeRequest, { readonly sent: true }> = {
    access: { kind: "public" },
    applicationErrors: ["conflict", "invalid_request", "not_found"],
    execute: async (input) => {
      const result = await getService().request({
        destination: input.email,
        kind: emailMethodKind,
      });
      if (result.ok) return { ok: true, value: { sent: true } };
      switch (result.reason) {
        case "invalid-destination":
          return failure("invalid_request", "Enter a valid email address.");
        case "unsupported-channel":
          return failure("not_found", "Signing in by email is not available.");
        case "delivery-failed":
          return failure(
            "conflict",
            "The code could not be sent. Try again in a moment.",
          );
        case "cooldown":
        case "limit":
          return failure(
            "conflict",
            `A code was sent recently. You can ask for another in ${waitText(result.retryAfterMs)}.`,
          );
      }
    },
    idempotency: "none",
    input: "json",
    inputSchema: emailCodeRequestSchema,
    outputSchema: emailCodeRequestResponseSchema,
    ...emailCodeRoutes.request,
  };
  const verify: HttpOperation<EmailCodeVerify, { readonly signedIn: true }> = {
    access: { kind: "public" },
    applicationErrors: ["unauthorized"],
    execute: async (input) => {
      const result = await getService().verify({
        code: input.code,
        destination: input.email,
        kind: emailMethodKind,
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
    inputSchema: emailCodeVerifySchema,
    outputSchema: emailCodeSignedInResponseSchema,
    ...emailCodeRoutes.verify,
  };
  return [request, verify] as const;
}
