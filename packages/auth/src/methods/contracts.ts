import { methodKindSchema, type MethodKind } from "@ador/shared/accounts";

// What every sign-in method has in common, and the one port a method implements to join an account. Nothing here names a method: the
// kinds are data (`wallet`, `passkey`, `email`, later `phone`), so adding one changes no rule and no repository.

// A method's name: lower case, starting with a letter, as it appears in routes, audit evidence and the pages. Defined once, in
// `@ador/shared/accounts`, because the platform roles' requirements name kinds too.
export { methodKindSchema, type MethodKind };

// How much an account's holding a method says about the person, lowest first. Policy states the level an action needs; a method never
// decides its own importance. Wallet and passkey are strong; an email code is standard; a text message is basic (SIM swap).
export const assuranceLevels = ["basic", "standard", "strong"] as const;
export type AssuranceLevel = (typeof assuranceLevels)[number];

export function assuranceRank(level: AssuranceLevel): number {
  return assuranceLevels.indexOf(level);
}

// One method an account has right now.
export interface LinkedMethod {
  readonly assurance: AssuranceLevel;
  // Whether this method can start a session. Removing the last one that can would lock the account out.
  readonly canSignIn: boolean;
  // The method's own identifier: the wallet identity's id, the passkey's credential id.
  readonly id: string;
  readonly kind: MethodKind;
}

// A kind of method as the pages and policy see it, with nothing of any one account.
export interface MethodDescription {
  readonly assurance: AssuranceLevel;
  readonly canSignIn: boolean;
  readonly kind: MethodKind;
}

// What a method gives the registry. `Context` is the caller's transaction (the database's, in practice), so a listing is read under the
// caller's lock and a decision to remove a method is made on what is there.
export interface MethodAdapter<Context> extends MethodDescription {
  // The ids of this kind of method the account has. Reads only.
  list(context: Context, userId: string): Promise<readonly string[]>;
  // A short, human way to name an account by what it holds of this kind (an address, a shortened wallet), or null when it holds none
  // or the kind has nothing readable. Used where an administrator must recognise a person.
  label?(context: Context, userId: string): Promise<string | null>;
  // The accounts that hold this kind of method written exactly as `text` (after the kind's own normalizing). Exact only: it finds a
  // person who is named, it never browses.
  lookup?(context: Context, text: string): Promise<readonly string[]>;
}

export type ListMethods<Context> = (
  context: Context,
  userId: string,
) => Promise<readonly LinkedMethod[]>;
