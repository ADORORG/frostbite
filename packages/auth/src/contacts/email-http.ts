import { z } from "zod";

// Signing in with a code sent by email. Both steps are open to anyone, because there is no session yet.
export const emailCodeRoutes = {
  // Adding an address to, listing the addresses of, and removing one from the account that is signed in.
  addresses: {
    method: "GET",
    operationId: "listEmailAddresses",
    path: "/api/v1/email/addresses",
  },
  linkRequest: {
    method: "POST",
    operationId: "requestEmailLinkCode",
    path: "/api/v1/email/link/request",
  },
  linkVerify: {
    method: "POST",
    operationId: "verifyEmailLinkCode",
    path: "/api/v1/email/link/verify",
  },
  unlink: {
    method: "POST",
    operationId: "unlinkEmailAddress",
    path: "/api/v1/email/unlink",
  },
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

export const emailEmptyInputSchema = z.strictObject({});
// The account's addresses, the oldest first, each with when it was added, and how many the account may hold.
export const emailAddressesResponseSchema = z.strictObject({
  addresses: z.array(
    z.strictObject({
      addedAt: z.iso.datetime(),
      address: z.string().min(1),
    }),
  ),
  maximum: z.number().int().min(1),
});
export const emailLinkedResponseSchema = z.strictObject({
  changed: z.literal(true),
});

export type EmailAddressesView = z.infer<typeof emailAddressesResponseSchema>;
export type EmailCodeRequest = z.infer<typeof emailCodeRequestSchema>;
export type EmailCodeVerify = z.infer<typeof emailCodeVerifySchema>;
