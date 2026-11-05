import { createUuidV7 } from "@frostbite/shared/identifiers";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateRegistrationOptions, verifyRegistrationResponse } = vi.hoisted(
  () => ({
    generateRegistrationOptions: vi.fn(),
    verifyRegistrationResponse: vi.fn(),
  }),
);

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions,
  verifyRegistrationResponse,
}));

import { simpleWebAuthnRegistrationAdapter } from "../src/passkeys/simplewebauthn-adapter.ts";
import { sha256 } from "../src/domain/crypto.ts";

describe("SimpleWebAuthn adapter mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps verified credential metadata into the provider-neutral contract", async () => {
    verifyRegistrationResponse.mockResolvedValue({
      registrationInfo: {
        credential: {
          counter: 4,
          id: "credential",
          publicKey: new Uint8Array([1]),
          transports: ["internal", "unsupported"],
        },
        credentialBackedUp: true,
        credentialDeviceType: "multiDevice",
      },
      verified: true,
    });
    await expect(
      simpleWebAuthnRegistrationAdapter.verify({
        challengeHash: sha256("expected"),
        expectedOrigin: "https://launch.invalid",
        payload: {
          clientExtensionResults: {},
          id: "credential",
          rawId: "credential",
          response: {
            attestationObject: "value",
            clientDataJSON: "value",
            transports: ["internal"],
          },
          type: "public-key",
        },
        relyingPartyId: "launch.invalid",
      }),
    ).resolves.toEqual({
      backedUp: true,
      counter: 4,
      credentialId: "credential",
      deviceType: "multiDevice",
      publicKey: new Uint8Array([1]),
      transports: ["internal"],
    });
    const verifierInput = verifyRegistrationResponse.mock.calls[0]?.[0];
    expect(verifierInput.expectedOrigin).toBe("https://launch.invalid");
    expect(verifierInput.expectedRPID).toBe("launch.invalid");
    expect(verifierInput.requireUserVerification).toBe(true);
    expect(verifierInput.expectedChallenge("expected")).toBe(true);
    expect(verifierInput.expectedChallenge("wrong")).toBe(false);
  });

  it("maps an unverified result to failure without invented metadata", async () => {
    verifyRegistrationResponse.mockResolvedValue({ verified: false });
    await expect(
      simpleWebAuthnRegistrationAdapter.verify({
        challengeHash: "a".repeat(64),
        expectedOrigin: "https://launch.invalid",
        payload: {
          clientExtensionResults: {},
          id: "credential",
          rawId: "credential",
          response: { attestationObject: "value", clientDataJSON: "value" },
          type: "public-key",
        },
        relyingPartyId: "launch.invalid",
      }),
    ).resolves.toBeNull();
  });

  it("defaults missing transports and contains provider exceptions", async () => {
    verifyRegistrationResponse.mockResolvedValueOnce({
      registrationInfo: {
        credential: {
          counter: 0,
          id: "credential",
          publicKey: new Uint8Array([1]),
        },
        credentialBackedUp: false,
        credentialDeviceType: "singleDevice",
      },
      verified: true,
    });
    const input = {
      challengeHash: "a".repeat(64),
      expectedOrigin: "https://launch.invalid",
      payload: {
        clientExtensionResults: {},
        id: "credential",
        rawId: "credential",
        response: { attestationObject: "value", clientDataJSON: "value" },
        type: "public-key" as const,
      },
      relyingPartyId: "launch.invalid",
    };
    await expect(
      simpleWebAuthnRegistrationAdapter.verify(input),
    ).resolves.toMatchObject({
      transports: [],
    });
    verifyRegistrationResponse.mockRejectedValueOnce(new Error("provider"));
    await expect(
      simpleWebAuthnRegistrationAdapter.verify(input),
    ).resolves.toBeNull();
  });

  it("passes UUID bytes and exact RP policy to option generation", async () => {
    generateRegistrationOptions.mockResolvedValue({
      attestation: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      challenge: "generated",
      excludeCredentials: [],
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      rp: { id: "launch.invalid", name: "Launch" },
      timeout: 60_000,
      user: { displayName: "Player", id: "user", name: "Player" },
    });
    const userId = createUuidV7();
    await expect(
      simpleWebAuthnRegistrationAdapter.createOptions({
        challenge: "Y2hhbGxlbmdl",
        existingCredentialIds: [],
        relyingPartyId: "launch.invalid",
        relyingPartyName: "Launch",
        userId,
        userName: "Player",
      }),
    ).resolves.toMatchObject({
      challenge: "generated",
      rp: { id: "launch.invalid", name: "Launch" },
    });
    expect(generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ rpID: "launch.invalid", userName: "Player" }),
    );
  });
});
