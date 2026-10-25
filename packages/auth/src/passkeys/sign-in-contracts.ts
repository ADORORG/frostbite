import { z } from "zod";

import type { AuthenticatorTransport } from "./contracts.ts";

// Signing in with a passkey: the browser is given a challenge and no list of credentials (so the response reveals nothing about
// which accounts exist), the authenticator offers one of its discoverable credentials, and the server finds the account from it.

const base64UrlSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/);

export const passkeyAuthenticationPayloadSchema = z.strictObject({
  authenticatorAttachment: z.enum(["cross-platform", "platform"]).optional(),
  clientExtensionResults: z.record(z.string(), z.json()),
  id: base64UrlSchema,
  rawId: base64UrlSchema,
  response: z.strictObject({
    authenticatorData: base64UrlSchema,
    clientDataJSON: base64UrlSchema,
    signature: base64UrlSchema,
    userHandle: base64UrlSchema.optional(),
  }),
  type: z.literal("public-key"),
});
export type PasskeyAuthenticationPayload = z.infer<
  typeof passkeyAuthenticationPayloadSchema
>;

export const passkeyAuthenticationOptionsSchema = z.strictObject({
  challenge: base64UrlSchema,
  rpId: z.string().min(1),
  timeout: z.number().int().positive().optional(),
  userVerification: z.enum(["discouraged", "preferred", "required"]),
});
export type PasskeyAuthenticationOptions = z.infer<
  typeof passkeyAuthenticationOptionsSchema
>;

// A credential as the database holds it, for checking a signature against.
export interface StoredPasskeyCredential {
  readonly counter: number;
  readonly credentialId: string;
  readonly publicKey: Uint8Array<ArrayBuffer>;
  readonly transports: readonly AuthenticatorTransport[];
  readonly userId: string;
}

export interface PasskeyAuthenticationAdapter {
  createOptions(input: {
    readonly challenge: string;
    readonly relyingPartyId: string;
  }): Promise<PasskeyAuthenticationOptions>;
  // The signature counter after this sign-in, or null when the response is not a valid, user-verified answer to this challenge from
  // this credential at this origin.
  verify(input: {
    readonly challengeHash: string;
    readonly credential: StoredPasskeyCredential;
    readonly expectedOrigin: string;
    readonly payload: PasskeyAuthenticationPayload;
    readonly relyingPartyId: string;
  }): Promise<{ readonly counter: number } | null>;
}

// Why a sign-in did not happen. The caller is told one thing for all of them.
export type PasskeySignInFailure =
  | "challenge-invalid"
  | "credential-unknown"
  | "not-verified"
  | "counter-conflict";
