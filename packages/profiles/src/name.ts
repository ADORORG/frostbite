import {
  nameShapeProblem,
  type ProfileNameReason,
} from "@frostbite/shared/profiles";

import type { ProfilePolicy } from "./policy.ts";

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

// Why a name cannot be used, or null when it can: its shape (the same check the form runs), then the blocked words.
export function nameProblem(
  name: string,
  policy: ProfilePolicy,
): ProfileNameReason | null {
  const shape = nameShapeProblem(name, policy);
  if (shape !== null) return shape;
  const text = normalizedForBlocklist(name);
  return policy.blockedTerms.some((term) => text.includes(term))
    ? "blocked"
    : null;
}
