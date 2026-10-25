import { describe, expect, it } from "vitest";

import { sha256 } from "../src/domain/crypto.ts";
import { simpleWebAuthnAuthenticationAdapter } from "../src/passkeys/simplewebauthn-authentication.ts";
import { createSoftwareAuthenticator } from "./support/software-authenticator.ts";

const origin = "https://launch.invalid";
const relyingPartyId = "launch.invalid";
const challenge = "Y2hhbGxlbmdlLWJ5dGVzLWZvci10aGUtdGVzdA";

async function setup(counter = 0) {
  const authenticator = await createSoftwareAuthenticator();
  const credential = {
    counter,
    credentialId: authenticator.credentialId,
    publicKey: authenticator.publicKey,
    transports: ["internal"] as const,
    userId: "user-one",
  };
  const verify = async (
    payload: Awaited<ReturnType<typeof authenticator.assert>>,
    overrides: Partial<
      Parameters<typeof simpleWebAuthnAuthenticationAdapter.verify>[0]
    > = {},
  ) =>
    simpleWebAuthnAuthenticationAdapter.verify({
      challengeHash: sha256(challenge),
      credential,
      expectedOrigin: origin,
      payload,
      relyingPartyId,
      ...overrides,
    });
  const assertion = (
    overrides: Partial<Parameters<typeof authenticator.assert>[0]> = {},
  ) =>
    authenticator.assert({
      challenge,
      counter: counter + 1,
      origin,
      relyingPartyId,
      ...overrides,
    });
  return { assertion, authenticator, credential, verify };
}

describe("SimpleWebAuthn authentication adapter", () => {
  it("asks for the challenge it was given, bound to the relying party, and demands user verification", async () => {
    expect(
      await simpleWebAuthnAuthenticationAdapter.createOptions({
        challenge,
        relyingPartyId,
      }),
    ).toMatchObject({
      challenge,
      rpId: relyingPartyId,
      userVerification: "required",
    });
  });

  it("accepts a real signature from the credential and reports the new counter", async () => {
    const { assertion, verify } = await setup(4);
    expect(await verify(await assertion())).toEqual({ counter: 5 });
  });

  it("accepts an authenticator that never counts (zero before and after)", async () => {
    const { assertion, verify } = await setup(0);
    expect(await verify(await assertion({ counter: 0 }))).toEqual({
      counter: 0,
    });
  });

  it.each([
    ["a different challenge", { challenge: "b3RoZXItY2hhbGxlbmdl" }],
    ["another origin", { origin: "https://attacker.invalid" }],
    ["another relying party", { relyingPartyId: "attacker.invalid" }],
    ["a user who was not verified", { userVerified: false }],
    ["a user who was not present", { userPresent: false }],
  ])("refuses an answer for %s", async (_why, change) => {
    const { assertion, verify } = await setup(0);
    expect(await verify(await assertion(change))).toBeNull();
  });

  it("refuses a counter that did not move forward, which is how a cloned authenticator shows itself", async () => {
    const { assertion, verify } = await setup(7);
    expect(await verify(await assertion({ counter: 7 }))).toBeNull();
    expect(await verify(await assertion({ counter: 3 }))).toBeNull();
  });

  it("refuses a signature from another key, and one that was altered", async () => {
    const { assertion, verify } = await setup(0);
    const other = await createSoftwareAuthenticator();
    const forged = await other.assert({
      challenge,
      counter: 1,
      origin,
      relyingPartyId,
    });
    expect(
      await verify({ ...forged, id: forged.id, rawId: forged.rawId }),
    ).toBeNull();
    const genuine = await assertion();
    const altered = {
      ...genuine,
      response: {
        ...genuine.response,
        signature: Buffer.from(
          Buffer.from(genuine.response.signature, "base64url").map((byte, i) =>
            i === 10 ? byte ^ 0xff : byte,
          ),
        ).toString("base64url"),
      },
    };
    expect(await verify(altered)).toBeNull();
  });

  it("fails closed for a malformed response", async () => {
    const { assertion, verify } = await setup(0);
    const genuine = await assertion();
    expect(
      await verify({
        ...genuine,
        response: {
          authenticatorData: "!!",
          clientDataJSON: "!!",
          signature: "!!",
        },
      }),
    ).toBeNull();
  });
});
