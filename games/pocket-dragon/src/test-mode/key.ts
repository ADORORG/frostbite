// Test mode is for the game's admin, and only the admin's key unlocks it. The key itself is never in the game: what is here is a salted,
// slow hash of it (PBKDF2 with SHA-256), which can tell the right key when it is typed but cannot give the key back, and the key is long
// and random, so it cannot be guessed from the hash either. A key is read as its letters and digits, in any case, so "ab12-cd34" and
// "AB12CD34" are the same key. To change the key, see the README ("Test mode").
export interface KeyHash {
  // The hash and the salt, in hexadecimal.
  readonly hash: string;
  readonly iterations: number;
  readonly salt: string;
}

export const adminKey: KeyHash = {
  hash: "fc12c8b3316273c2d4cff069087d611f86c5c608b0fa0e4b4561d7f7cad2e917",
  iterations: 600_000,
  salt: "32ea035e32b042f515a999486abe134b",
};

export const keyText = (typed: string): string =>
  typed.toUpperCase().replace(/[^0-9A-Z]/gu, "");

const bytesOf = (hex: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(hex.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));

const hexOf = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

// Whether a typed key is the admin's: false for nothing typed, and where the browser has no WebCrypto to check it with. Every character
// of the hash is compared, whatever the first that differs.
export async function keyMatches(
  typed: string,
  known: KeyHash = adminKey,
  subtle: SubtleCrypto | null = globalThis.crypto?.subtle ?? null,
): Promise<boolean> {
  const text = keyText(typed);
  if (subtle === null || text.length === 0) return false;
  const material = await subtle.importKey(
    "raw",
    new TextEncoder().encode(text),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations: known.iterations,
      name: "PBKDF2",
      salt: bytesOf(known.salt),
    },
    material,
    256,
  );
  const made = hexOf(new Uint8Array(bits));
  let differs = made.length ^ known.hash.length;
  for (let at = 0; at < made.length; at += 1)
    differs |= made.charCodeAt(at) ^ (known.hash.charCodeAt(at) || 0);
  return differs === 0;
}
