// What stands in for a picture that is not there: a colour scheme chosen from the name, so the same thing always looks the same
// and different things do not all look alike, and its initials. A row of unlit squares is not a catalog.
export const standInTones = 6;

export function standInTone(name: string): number {
  let hash = 0;
  for (const character of name)
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  return hash % standInTones;
}

// Up to two capital letters, from the first letters of the first two words ("Frost Bite" is "FB"; "Tap" is "T").
export function standInInitials(name: string): string {
  return name
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase())
    .join("");
}
