import { z } from "zod";

// Signing in with a code sent by email. Both steps are open to anyone, because there is no session yet.
export const emailCodeRoutes = {
  request: {
    method: "POST",
    operationId: "requestEmailCode",
    path: "/api/v1/email/sign-in/request",
  },
  verify: {
    method: "POST",
    operationId: "verifyEmailCode",
    path: "/api/v1/email/sign-in/verify",
  },
} as const;

// Only the size is checked here; whether it is an address is the channel's call (it normalizes), so the answer is the same however a
// bad one fails. The bounds stop a request from carrying a large body into the service.
const emailTextSchema = z.string().min(1).max(320);

export const emailCodeRequestSchema = z.strictObject({
  email: emailTextSchema,
});
export const emailCodeRequestResponseSchema = z.strictObject({
  sent: z.literal(true),
});
export const emailCodeVerifySchema = z.strictObject({
  code: z.string().min(1).max(12),
  email: emailTextSchema,
});
export const emailCodeSignedInResponseSchema = z.strictObject({
  signedIn: z.literal(true),
});

export type EmailCodeRequest = z.infer<typeof emailCodeRequestSchema>;
export type EmailCodeVerify = z.infer<typeof emailCodeVerifySchema>;
