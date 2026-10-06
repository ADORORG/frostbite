import { describe, expect, it } from "vitest";
import {
  qualificationBeginSchema,
  qualificationChallengeSchema,
  qualificationResultSchema,
  qualificationVerifySchema,
  walletQualificationBounds,
} from "../src/auth/qualification.ts";
const id = "01992cca-9c00-7000-8000-000000000001";
describe("wallet qualification wire contracts", () => {
  it("accepts only bounded candidate and challenge inputs", () => {
    expect(
      qualificationBeginSchema.parse({
        address: "candidate",
        provider: "xverse",
        network: "signet",
      }),
    ).toEqual({ address: "candidate", provider: "xverse", network: "signet" });
    expect(
      qualificationChallengeSchema.parse({
        challengeId: id,
        expiresAt: "2026-10-04T12:00:00.000Z",
        message: "test",
        signatureScheme: "bip322-simple",
      }).signatureScheme,
    ).toBe("bip322-simple");
    expect(
      qualificationBeginSchema.safeParse({
        address: "x".repeat(walletQualificationBounds.addressCharacters + 1),
        provider: "xverse",
        network: "signet",
      }).success,
    ).toBe(false);
    expect(
      qualificationVerifySchema.safeParse({
        challengeId: id,
        message: "x".repeat(walletQualificationBounds.messageCharacters + 1),
        signature: "signature",
      }).success,
    ).toBe(false);
    expect(
      qualificationVerifySchema.safeParse({
        challengeId: id,
        message: "test",
        signature: "x".repeat(
          walletQualificationBounds.signatureCharacters + 1,
        ),
      }).success,
    ).toBe(false);
    expect(
      qualificationVerifySchema.safeParse({
        challengeId: id,
        message: "test",
        signature: "signature",
        sessionToken: "must-not-exist",
      }).success,
    ).toBe(false);
  });
  it("rejects an oversized server challenge message", () => {
    expect(
      qualificationChallengeSchema.safeParse({
        challengeId: id,
        expiresAt: "2026-10-04T12:00:00.000Z",
        message: "x".repeat(walletQualificationBounds.messageCharacters + 1),
        signatureScheme: "bip322-simple",
      }).success,
    ).toBe(false);
  });
  it("cannot represent successful sign-in or a session token", () => {
    expect(
      qualificationResultSchema.parse({
        signatureVerified: true,
        sessionCreated: false,
      }),
    ).toEqual({ signatureVerified: true, sessionCreated: false });
    expect(
      qualificationResultSchema.safeParse({
        signatureVerified: true,
        sessionCreated: true,
      }).success,
    ).toBe(false);
    expect(
      qualificationResultSchema.safeParse({
        signatureVerified: true,
        sessionCreated: false,
        sessionToken: "secret",
      }).success,
    ).toBe(false);
  });
});
