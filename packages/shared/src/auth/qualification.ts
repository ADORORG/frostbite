import { z } from "zod";
import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";

// Wire bounds limit work at this untrusted diagnostic boundary, not wallet policy.
export const walletQualificationBounds = {
  addressCharacters: 90,
  providerCharacters: 64,
  messageCharacters: 4096,
  signatureCharacters: 4096,
} as const;

// Matches the accepted five-minute challenge lifetime; diagnostic attempts are bounded.
export const walletQualificationDefaults = {
  lifetimeMs: 5 * 60 * 1000,
  maximumAttempts: 3,
} as const;

// The attempts column is a PostgreSQL integer (int4); larger bounds fail at the database.
export const walletQualificationMaximumAttemptsLimit = 2 ** 31 - 1;

export const qualificationBeginSchema = z.strictObject({
  address: z.string().min(1).max(walletQualificationBounds.addressCharacters),
  provider: z.string().min(1).max(walletQualificationBounds.providerCharacters),
  network: z.enum(["mainnet", "signet"]),
});
export const qualificationChallengeSchema = z.strictObject({
  challengeId: uuidV7TextSchema,
  expiresAt: z.iso.datetime(),
  message: z.string().min(1).max(walletQualificationBounds.messageCharacters),
  signatureScheme: z.literal("bip322-simple"),
});
export const qualificationVerifySchema = z.strictObject({
  challengeId: uuidV7TextSchema,
  message: z.string().min(1).max(walletQualificationBounds.messageCharacters),
  signature: z
    .string()
    .min(1)
    .max(walletQualificationBounds.signatureCharacters),
});
export const qualificationResultSchema = z.strictObject({
  signatureVerified: z.literal(true),
  sessionCreated: z.literal(false),
});
export const qualificationRoutes = {
  begin: {
    method: "POST",
    operationId: "beginWalletQualification",
    path: "/api/v1/wallet-qualification/challenge",
  },
  verify: {
    method: "POST",
    operationId: "verifyWalletQualification",
    path: "/api/v1/wallet-qualification/verify",
  },
} as const;
export type QualificationBegin = z.infer<typeof qualificationBeginSchema>;
export type QualificationChallenge = z.infer<
  typeof qualificationChallengeSchema
>;
export type QualificationVerify = z.infer<typeof qualificationVerifySchema>;
export type QualificationResult = z.infer<typeof qualificationResultSchema>;
