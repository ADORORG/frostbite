import type { Psbt } from "bitcoinjs-lib";

// Bytes per `String.fromCharCode` call. Passing every byte of a large array to one call overflows the call stack (the arguments sit
// on it), which is what the library's own browser `toBase64` does: it spreads the whole array. A template's reveal is over 100 KB.
const bytesPerChunk = 0x8000;

// A PSBT as base64 text, the form it travels in. The same text as `psbt.toBase64()`, but safe for the largest PSBT in a browser,
// where the library's version fails with "Maximum call stack size exceeded" (the server's build is not affected).
export function psbtToBase64(psbt: Psbt): string {
  const bytes = psbt.toBuffer();
  let binary = "";
  for (let start = 0; start < bytes.length; start += bytesPerChunk)
    binary += String.fromCharCode(
      ...bytes.subarray(start, start + bytesPerChunk),
    );
  return btoa(binary);
}
