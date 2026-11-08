import type { ProfileAvatarId } from "@frostbite/shared/profiles";

// A profile as stored.
export interface StoredProfile {
  readonly avatar: ProfileAvatarId;
  readonly createdAt: Date;
  readonly name: string;
  readonly nameChangedAt: Date;
  readonly nameKey: string;
  readonly updatedAt: Date;
  readonly userId: string;
  readonly visible: boolean;
}

export type SaveOutcome =
  { readonly kind: "saved" } | { readonly kind: "name-taken" };

// Where profiles live. `save` creates the player's profile or replaces it, and says `name-taken` when another player holds the name (the
// table's unique key decides, so two players choosing the same name together cannot both win). `find` is the player's own; `findPublic`
// is by name and answers only for a profile that is switched on.
export interface ProfileRepository {
  delete(userId: string): Promise<boolean>;
  find(userId: string): Promise<StoredProfile | null>;
  findPublic(nameKey: string): Promise<StoredProfile | null>;
  // Who holds a name, if anyone, shown or not: a hidden profile still owns its name.
  holderOf(nameKey: string): Promise<string | null>;
  save(profile: StoredProfile): Promise<SaveOutcome>;
}
