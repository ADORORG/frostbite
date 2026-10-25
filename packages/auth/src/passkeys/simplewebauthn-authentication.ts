import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";

import { sha256 } from "../domain/crypto.ts";
import type {
  PasskeyAuthenticationAdapter,
  PasskeyAuthenticationPayload,
} from "./sign-in-contracts.ts";

function toVendorPayload(
  payload: PasskeyAuthenticationPayload,
): AuthenticationResponseJSON {
  return {
    ...payload,
    clientExtensionResults: { ...payload.clientExtensionResults },
    response: { ...payload.response },
  };
}

// The vendor library behind the port: it checks the origin, the relying-party id, the user-verification flag, the signature over the
// authenticator data and the client data, and that the signature counter moved forward.
export const simpleWebAuthnAuthenticationAdapter: PasskeyAuthenticationAdapter =
  {
    async createOptions(input) {
      const options = await generateAuthenticationOptions({
        challenge: new Uint8Array(Buffer.from(input.challenge, "base64url")),
        rpID: input.relyingPartyId,
        userVerification: "required",
      });
      return {
        challenge: options.challenge,
        rpId: input.relyingPartyId,
        timeout: options.timeout,
        userVerification: "required",
      };
    },
    async verify(input) {
      try {
        const result = await verifyAuthenticationResponse({
          credential: {
            counter: input.credential.counter,
            id: input.credential.credentialId,
            publicKey: input.credential.publicKey,
            transports: [...input.credential.transports],
          },
          expectedChallenge: (value) => sha256(value) === input.challengeHash,
          expectedOrigin: input.expectedOrigin,
          expectedRPID: input.relyingPartyId,
          requireUserVerification: true,
          response: toVendorPayload(input.payload),
        });
        return result.verified
          ? { counter: result.authenticationInfo.newCounter }
          : null;
      } catch {
        return null;
      }
    },
  };
