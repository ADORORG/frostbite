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
} from "@frostbite/auth";
import type { HttpOperation } from "@frostbite/http";
import {
  codeNotVerified,
  codeRequestFailure,
} from "./email-request-results.ts";

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
      return result.ok
        ? { ok: true, value: { sent: true } }
        : codeRequestFailure(result);
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
        : codeNotVerified;
    },
    idempotency: "none",
    input: "json",
    inputSchema: emailCodeVerifySchema,
    outputSchema: emailCodeSignedInResponseSchema,
    ...emailCodeRoutes.verify,
  };
  return [request, verify] as const;
}
