import * as ecc from "@bitcoinerlab/secp256k1";

// A key made for one commit-and-reveal step. It guards only the small amount paid to the commit address, signs the reveal once,
// and is then destroyed; the platform keeps no signing key between steps.
export interface OneTimeKey {
  // Zeroes the secret. Call it once the reveal is signed.
  destroy(): void;
  readonly publicKey: Uint8Array;
  signSchnorr(hash: Uint8Array): Uint8Array;
  // Throws: the reveal is a script-path spend, signed with `signSchnorr` only.
  sign(): never;
  readonly xOnly: Uint8Array;
}

export type RandomBytes = (length: number) => Uint8Array;

const secretBytes = 32;
// A random 32-byte string is a valid secret key unless it is zero or at least the curve order, which is vanishingly rare; the loop
// is only for correctness, and the bound keeps a broken random source from hanging a step.
const attempts = 8;

export function newOneTimeKey(random: RandomBytes): OneTimeKey {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const secret = Uint8Array.from(random(secretBytes));
    if (secret.length !== secretBytes || !ecc.isPrivate(secret)) {
      secret.fill(0);
      continue;
    }
    const publicKey = ecc.pointFromScalar(secret, true);
    if (publicKey === null) {
      secret.fill(0);
      continue;
    }
    return {
      destroy: () => secret.fill(0),
      publicKey,
      sign: () => {
        throw new Error("A one-time key signs script-path spends only.");
      },
      // BIP 340 signing mixes in fresh random bytes, so the same hash signed twice gives two different (both valid) signatures; a test
      // supplies a fixed source to get the same bytes every time.
      signSchnorr: (hash) => ecc.signSchnorr(hash, secret, random(secretBytes)),
      xOnly: publicKey.slice(1, 33),
    };
  }
  throw new Error("The random source did not produce a usable key.");
}
