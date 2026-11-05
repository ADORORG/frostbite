import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it } from "vitest";

import { sha256 } from "../src/domain/crypto.ts";
import { simpleWebAuthnRegistrationAdapter } from "../src/passkeys/simplewebauthn-adapter.ts";

describe("SimpleWebAuthn registration adapter", () => {
  it("generates RP-bound, user-verifying resident-key options", async () => {
    const options = await simpleWebAuthnRegistrationAdapter.createOptions({
      challenge: "Y2hhbGxlbmdl",
      existingCredentialIds: ["existing"],
      relyingPartyId: "launch.invalid",
      relyingPartyName: "Launch",
      userId: createUuidV7(),
      userName: "Player",
    });

    expect(options).toMatchObject({
      attestation: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      challenge: "Y2hhbGxlbmdl",
      excludeCredentials: [{ id: "existing" }],
      rp: { id: "launch.invalid", name: "Launch" },
    });
  });

  it("fails closed for malformed or wrongly-bound attestations", async () => {
    await expect(
      simpleWebAuthnRegistrationAdapter.verify({
        challengeHash: sha256("expected"),
        expectedOrigin: "https://launch.invalid",
        payload: {
          clientExtensionResults: {},
          id: "credential",
          rawId: "credential",
          response: {
            attestationObject: "malformed",
            clientDataJSON: "malformed",
          },
          type: "public-key",
        },
        relyingPartyId: "launch.invalid",
      }),
    ).resolves.toBeNull();
  });
});
