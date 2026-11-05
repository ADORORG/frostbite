import { describe, expect, it } from "vitest";

import {
  passkeyBeginResponseSchema,
  passkeyFinishInputSchema,
  passkeyUnlinkInputSchema,
} from "../src/index.ts";
import { createUuidV7 } from "@frostbite/shared/identifiers";

const options = {
  challenge: "Y2hhbGxlbmdl",
  pubKeyCredParams: [{ alg: -7, type: "public-key" }],
  rp: { id: "launch.invalid", name: "Launch" },
  user: { displayName: "Player", id: "cGxheWVy", name: "Player" },
};
const credential = {
  clientExtensionResults: {},
  id: "credential",
  rawId: "credential",
  response: { attestationObject: "value", clientDataJSON: "value" },
  type: "public-key",
};

describe("passkey HTTP contracts", () => {
  it("accepts a complete provider-neutral ceremony", () => {
    expect(
      passkeyBeginResponseSchema.parse({
        challengeId: createUuidV7(),
        expiresAt: "2026-09-10T12:05:00.000Z",
        options,
      }),
    ).toMatchObject({ options });
    expect(
      passkeyFinishInputSchema.parse({
        challengeId: createUuidV7(),
        credential,
      }),
    ).toMatchObject({ credential });
  });

  it.each([
    { challengeId: "invalid", credential },
    { challengeId: createUuidV7(), credential: { ...credential, extra: true } },
    {
      challengeId: createUuidV7(),
      credential: { ...credential, id: "not base64!" },
    },
  ])("rejects malformed or unexpected registration input", (input) => {
    expect(passkeyFinishInputSchema.safeParse(input).success).toBe(false);
  });

  it.each(["", "not base64!", "a/b"])(
    "rejects unsafe credential ID %s",
    (credentialId) => {
      expect(passkeyUnlinkInputSchema.safeParse({ credentialId }).success).toBe(
        false,
      );
    },
  );
});
