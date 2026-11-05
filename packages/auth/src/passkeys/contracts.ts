import type { UuidV7 } from "@frostbite/shared/identifiers";
import { z } from "zod";

const base64UrlSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/);

export const authenticatorTransportSchema = z.enum([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);
export type AuthenticatorTransport = z.infer<
  typeof authenticatorTransportSchema
>;

export const passkeyRegistrationPayloadSchema = z.strictObject({
  authenticatorAttachment: z.enum(["cross-platform", "platform"]).optional(),
  clientExtensionResults: z.record(z.string(), z.json()),
  id: base64UrlSchema,
  rawId: base64UrlSchema,
  response: z.strictObject({
    attestationObject: base64UrlSchema,
    authenticatorData: base64UrlSchema.optional(),
    clientDataJSON: base64UrlSchema,
    publicKey: base64UrlSchema.optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    transports: z.array(authenticatorTransportSchema).optional(),
  }),
  type: z.literal("public-key"),
});

export const passkeyRegistrationOptionsSchema = z.strictObject({
  attestation: z.enum(["direct", "enterprise", "indirect", "none"]).optional(),
  authenticatorSelection: z
    .strictObject({
      residentKey: z.enum(["discouraged", "preferred", "required"]).optional(),
      userVerification: z
        .enum(["discouraged", "preferred", "required"])
        .optional(),
    })
    .optional(),
  challenge: base64UrlSchema,
  excludeCredentials: z
    .array(
      z.strictObject({
        id: base64UrlSchema,
        type: z.literal("public-key"),
      }),
    )
    .optional(),
  pubKeyCredParams: z.array(
    z.strictObject({ alg: z.number().int(), type: z.literal("public-key") }),
  ),
  rp: z.strictObject({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
  }),
  timeout: z.number().int().positive().optional(),
  user: z.strictObject({
    displayName: z.string(),
    id: base64UrlSchema,
    name: z.string().min(1),
  }),
});

export interface PasskeyPolicy {
  readonly challengeLifetimeMs: number;
  readonly recentAuthenticationWindowMs: number;
  readonly relyingPartyId: string;
  readonly relyingPartyName: string;
  readonly expectedOrigin: string;
  readonly sessionAbsoluteLifetimeMs: number;
  readonly sessionIdleLifetimeMs: number;
}

export type PasskeyRegistrationPayload = z.infer<
  typeof passkeyRegistrationPayloadSchema
>;

export type PasskeyRegistrationOptions = z.infer<
  typeof passkeyRegistrationOptionsSchema
>;

export interface VerifiedPasskeyCredential {
  readonly backedUp: boolean;
  readonly counter: number;
  readonly credentialId: string;
  readonly deviceType: "multiDevice" | "singleDevice";
  readonly publicKey: Uint8Array<ArrayBuffer>;
  readonly transports: readonly AuthenticatorTransport[];
}

export interface PasskeyRegistrationAdapter {
  createOptions(input: {
    readonly challenge: string;
    readonly existingCredentialIds: readonly string[];
    readonly relyingPartyId: string;
    readonly relyingPartyName: string;
    readonly userId: UuidV7;
    readonly userName: string;
  }): Promise<PasskeyRegistrationOptions>;
  verify(input: {
    readonly challengeHash: string;
    readonly expectedOrigin: string;
    readonly payload: PasskeyRegistrationPayload;
    readonly relyingPartyId: string;
  }): Promise<VerifiedPasskeyCredential | null>;
}

export type PasskeyLinkFailure =
  | "challenge-expired"
  | "challenge-invalid"
  | "challenge-replayed"
  | "credential-conflict"
  | "recent-authentication-required";
