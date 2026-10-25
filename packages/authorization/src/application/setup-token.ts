import { createHash } from "node:crypto";

// The secret in a setup link. 256 random bits, written as base64url so it fits in a URL fragment; only its SHA-256 is ever stored, so a
// copy of the database cannot be turned into a working link. A hash (not a slow password hash) is right here: the token is random and
// long, there is nothing to guess.
export const setupTokenBytes = 32;
const base64UrlLength = Math.ceil((setupTokenBytes * 4) / 3);
const tokenShape = new RegExp(`^[A-Za-z0-9_-]{${base64UrlLength}}$`);

export function encodeSetupToken(bytes: Uint8Array): string {
  if (bytes.length !== setupTokenBytes)
    throw new RangeError(
      `A setup token is ${setupTokenBytes} bytes, not ${bytes.length}.`,
    );
  return Buffer.from(bytes).toString("base64url");
}

// A string that cannot be a token is refused without touching the database.
export function isSetupTokenShaped(candidate: string): boolean {
  return tokenShape.test(candidate);
}

export function hashSetupToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
