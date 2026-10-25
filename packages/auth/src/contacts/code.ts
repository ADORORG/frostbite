import { randomInt, timingSafeEqual } from "node:crypto";

import { sha256 } from "../domain/crypto.ts";

const DECIMAL_BASE = 10;

// A code of `length` digits, each drawn uniformly (no modulo bias), so every code is as likely as any other.
export function generateCode(length: number): string {
  return Array.from({ length }, () => randomInt(DECIMAL_BASE)).join("");
}

// The salt keeps two equal codes from hashing alike. The digits are few, so the hash is no defence against someone who can read the
// table: the defence is the few tries and the short life (see the policy).
export function hashCode(code: string, salt: string): string {
  return sha256(`${salt}:${code}`);
}

// Whether the code matches the stored hash, in time that does not depend on how much of it matched.
export function codeMatches(
  code: string,
  salt: string,
  expectedHash: string,
): boolean {
  const given = Buffer.from(hashCode(code, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
