// The names the platform was first built under, in one place: a rename starts from this list and from the rules built on it (`rules.ts`),
// never from a search.
export const oldBrand = {
  display: "Ador",
  scope: "@ador",
  slug: "ador",
} as const;

// What the platform is called after the rename: the npm scope (`@frostbite`), the lower-case word used in identifiers and names
// (`frostbite`), and the name as a person reads it (`Frostbite`).
export interface NewBrand {
  readonly display: string;
  readonly scope: string;
  readonly slug: string;
}

const scopePattern = /^@[a-z][a-z0-9-]*$/u;
const slugPattern = /^[a-z][a-z0-9-]*$/u;

// Refuses a name the rules could not tell from the old one: a new name that contains the old one would be found again by the check after the
// rename, and rewritten again by a second run.
export function checkBrand(brand: NewBrand): NewBrand {
  if (!scopePattern.test(brand.scope))
    throw new Error(
      `The scope "${brand.scope}" must be an @ followed by lower-case letters, digits and hyphens.`,
    );
  if (!slugPattern.test(brand.slug))
    throw new Error(
      `The slug "${brand.slug}" must be lower-case letters, digits and hyphens, starting with a letter.`,
    );
  if (brand.display.trim() === "")
    throw new Error("The display name must not be empty.");
  for (const value of [brand.display, brand.scope, brand.slug])
    if (value.toLowerCase().includes(oldBrand.slug))
      throw new Error(`"${value}" still contains the old name.`);
  return brand;
}
