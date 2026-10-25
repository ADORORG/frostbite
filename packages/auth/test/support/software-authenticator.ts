import { createHash, randomBytes, webcrypto } from "node:crypto";

import type { PasskeyAuthenticationPayload } from "../../src/passkeys/sign-in-contracts.ts";

// A passkey in software, for tests: a real ES256 key pair that signs real WebAuthn assertions, so the verification under test is the
// vendor library's own and not a stand-in. Only what a sign-in needs is built (no attestation: tests store the credential directly).

const sha256 = (value: Uint8Array | string): Buffer =>
  createHash("sha256").update(value).digest();

// COSE_Key for an ES256 public key, CBOR-encoded: {1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y}.
function coseKey(x: Uint8Array, y: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
      x,
      Buffer.from([0x22, 0x58, 0x20]),
      y,
    ]),
  );
}

// The raw r||s signature WebCrypto makes, as the DER the WebAuthn specification expects.
function derSignature(raw: Uint8Array): Buffer {
  const integer = (bytes: Uint8Array): Buffer => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
    const trimmed = Buffer.from(bytes.subarray(start));
    const body =
      (trimmed[0] ?? 0) >= 0x80
        ? Buffer.concat([Buffer.from([0]), trimmed])
        : trimmed;
    return Buffer.concat([Buffer.from([0x02, body.length]), body]);
  };
  const body = Buffer.concat([
    integer(raw.subarray(0, 32)),
    integer(raw.subarray(32)),
  ]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

export interface AssertionOptions {
  readonly challenge: string;
  readonly counter: number;
  readonly origin: string;
  readonly relyingPartyId: string;
  // Flags in the authenticator data. A real passkey that verified its user sets both.
  readonly userPresent?: boolean;
  readonly userVerified?: boolean;
}

export async function createSoftwareAuthenticator() {
  const keys = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await webcrypto.subtle.exportKey("jwk", keys.publicKey);
  const x = Buffer.from(jwk.x ?? "", "base64url");
  const y = Buffer.from(jwk.y ?? "", "base64url");
  const credentialId = randomBytes(16).toString("base64url");
  return {
    credentialId,
    publicKey: coseKey(x, y),
    async assert(
      options: AssertionOptions,
    ): Promise<PasskeyAuthenticationPayload> {
      const clientDataJSON = Buffer.from(
        JSON.stringify({
          challenge: options.challenge,
          crossOrigin: false,
          origin: options.origin,
          type: "webauthn.get",
        }),
      );
      const flags =
        (options.userPresent === false ? 0 : 0x01) |
        (options.userVerified === false ? 0 : 0x04);
      const counter = Buffer.alloc(4);
      counter.writeUInt32BE(options.counter);
      const authenticatorData = Buffer.concat([
        sha256(options.relyingPartyId),
        Buffer.from([flags]),
        counter,
      ]);
      const signed = await webcrypto.subtle.sign(
        { hash: "SHA-256", name: "ECDSA" },
        keys.privateKey,
        Buffer.concat([authenticatorData, sha256(clientDataJSON)]),
      );
      return {
        clientExtensionResults: {},
        id: credentialId,
        rawId: credentialId,
        response: {
          authenticatorData: authenticatorData.toString("base64url"),
          clientDataJSON: clientDataJSON.toString("base64url"),
          signature: derSignature(new Uint8Array(signed)).toString("base64url"),
        },
        type: "public-key",
      };
    },
  };
}
