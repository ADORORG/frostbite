import { Psbt } from "bitcoinjs-lib";

import { psbtToBase64 } from "../psbt-text.ts";

// A step with two transactions travels as one payload: the commit (which the staff's wallet signs) and the reveal (which is signed
// already, except for the input that spends the auth token). They are sent in that order.
export const bundleFormat = "bitcoin-psbt-bundle";

export interface Bundle {
  readonly commit: Psbt;
  readonly reveal: Psbt;
}

export function encodeBundle(bundle: Bundle): string {
  return JSON.stringify({
    commit: psbtToBase64(bundle.commit),
    reveal: psbtToBase64(bundle.reveal),
  });
}

// Null for anything that is not exactly the two PSBTs `encodeBundle` writes.
export function decodeBundle(payload: string): Bundle | null {
  try {
    const parsed: { commit?: string; reveal?: string } & object =
      JSON.parse(payload);
    const keys = Object.keys(parsed).sort().join();
    if (
      keys !== "commit,reveal" ||
      typeof parsed.commit !== "string" ||
      typeof parsed.reveal !== "string"
    ) {
      return null;
    }
    return {
      commit: Psbt.fromBase64(parsed.commit),
      reveal: Psbt.fromBase64(parsed.reveal),
    };
  } catch {
    return null;
  }
}
