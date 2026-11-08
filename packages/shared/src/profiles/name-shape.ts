import type { ProfileNameReason } from "./contracts.ts";

// A name is letters, digits, `_` and `-`, and starts with a letter or a digit: URL-safe as it stands, since it is the page's address.
const plain = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;

// What is wrong with a name's shape, or null when its characters and length are fine. The same check runs in the form (so it says so while
// the player types) and on the server (which also checks the blocked words and whether the name is free). Length is counted on the name as
// typed; nothing is trimmed, so a name with a space is `bad-characters`, not a shorter name.
export function nameShapeProblem(
  name: string,
  bounds: { readonly maxLength: number; readonly minLength: number },
): Exclude<ProfileNameReason, "blocked"> | null {
  if (name.length === 0) return "too-short";
  if (!plain.test(name)) return "bad-characters";
  if (name.length < bounds.minLength) return "too-short";
  if (name.length > bounds.maxLength) return "too-long";
  return null;
}
