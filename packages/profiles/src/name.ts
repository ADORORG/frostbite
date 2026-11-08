import type { ProfileNameReason } from "@frostbite/shared/profiles";

import type { ProfilePolicy } from "./policy.ts";

// A name is letters, digits, `_` and `-`, and starts with a letter or a digit: URL-safe as it stands, since it is the page's address.
const plain = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;

// Digits that stand for letters, read as those letters when looking for a blocked word, so "adm1n" does not get past "admin".
const lookAlikes: Readonly<Record<string, string>> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
};

// The text a name is checked against the blocked words as: lower case, without `_` and `-`, look-alike digits read as letters.
export function normalizedForBlocklist(name: string): string {
  return [...name.toLowerCase().replaceAll(/[_-]/gu, "")]
    .map((character) => lookAlikes[character] ?? character)
    .join("");
}

// The name in the form the table keeps it unique on.
export const nameKeyOf = (name: string): string => name.toLowerCase();

// Why a name cannot be used, or null when it can. Length is counted in characters of the name as typed; nothing is trimmed, so a name
// with a space is `bad-characters`, not a shorter name.
export function nameProblem(
  name: string,
  policy: ProfilePolicy,
): ProfileNameReason | null {
  if (name.length === 0) return "too-short";
  if (!plain.test(name)) return "bad-characters";
  if (name.length < policy.minLength) return "too-short";
  if (name.length > policy.maxLength) return "too-long";
  const text = normalizedForBlocklist(name);
  return policy.blockedTerms.some((term) => text.includes(term))
    ? "blocked"
    : null;
}
