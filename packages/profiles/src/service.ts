import type {
  ProfileAvatarId,
  ProfileNameReason,
} from "@frostbite/shared/profiles";

import { nameKeyOf, nameProblem } from "./name.ts";
import type { ProfilePolicy } from "./policy.ts";
import type { ProfileRepository, StoredProfile } from "./repository.ts";

export type NameCheck =
  | { readonly status: "available" }
  | { readonly status: "yours" }
  | { readonly status: "taken" }
  // The player named another name too recently to change it again.
  | { readonly status: "locked"; readonly until: Date }
  | { readonly status: "invalid"; readonly reason: ProfileNameReason };

export type SaveResult =
  | { readonly profile: StoredProfile; readonly status: "saved" }
  | {
      readonly reason: ProfileNameReason | null;
      readonly refusal: "name-invalid" | "name-locked" | "name-taken";
      readonly status: "refused";
      readonly until: Date | null;
    };

const dayMs = 86_400_000;

export interface ProfilesService {
  checkName(userId: string, name: string): Promise<NameCheck>;
  get(userId: string): Promise<StoredProfile | null>;
  // The profile a visitor may see for a name: only one that is switched on.
  getPublic(name: string): Promise<StoredProfile | null>;
  readonly policy: ProfilePolicy;
  remove(userId: string): Promise<boolean>;
  save(
    userId: string,
    input: {
      readonly avatar: ProfileAvatarId;
      readonly name: string;
      readonly visible: boolean;
    },
  ): Promise<SaveResult>;
  // When a name may next change, or null when it may now.
  unlocksAt(profile: StoredProfile): Date | null;
}

// Makes, changes and removes a player's profile under the deployment's policy. A name is checked for its shape and blocked words, for
// being free (a hidden profile still owns its name), and for the cooldown since the player last changed theirs; changing only the
// capitals of one's own name, the picture, or whether the page is shown is never held back.
export function createProfilesService(options: {
  readonly clock: () => Date;
  readonly policy: ProfilePolicy;
  readonly repository: ProfileRepository;
}): ProfilesService {
  const { clock, policy, repository } = options;

  const unlocksAt = (profile: StoredProfile): Date | null => {
    const until = new Date(
      profile.nameChangedAt.getTime() + policy.changeCooldownDays * dayMs,
    );
    return until > clock() ? until : null;
  };

  async function checkName(userId: string, name: string): Promise<NameCheck> {
    const problem = nameProblem(name, policy);
    if (problem !== null) return { reason: problem, status: "invalid" };
    const key = nameKeyOf(name);
    const own = await repository.find(userId);
    if (own?.nameKey === key) return { status: "yours" };
    if (own !== null) {
      const until = unlocksAt(own);
      if (until !== null) return { status: "locked", until };
    }
    return (await repository.holderOf(key)) === null
      ? { status: "available" }
      : { status: "taken" };
  }

  return {
    checkName,
    get: (userId) => repository.find(userId),
    getPublic: async (name) =>
      nameProblem(name, policy) === null
        ? repository.findPublic(nameKeyOf(name))
        : null,
    policy,
    remove: (userId) => repository.delete(userId),
    save: async (userId, input) => {
      const problem = nameProblem(input.name, policy);
      if (problem !== null)
        return {
          reason: problem,
          refusal: "name-invalid",
          status: "refused",
          until: null,
        };
      const now = clock();
      const key = nameKeyOf(input.name);
      const own = await repository.find(userId);
      const renamed = own !== null && own.nameKey !== key;
      if (renamed) {
        const until = unlocksAt(own);
        if (until !== null)
          return {
            reason: null,
            refusal: "name-locked",
            status: "refused",
            until,
          };
      }
      const profile: StoredProfile = {
        avatar: input.avatar,
        createdAt: own?.createdAt ?? now,
        name: input.name,
        nameChangedAt: own === null || renamed ? now : own.nameChangedAt,
        nameKey: key,
        updatedAt: now,
        userId,
        visible: input.visible,
      };
      const outcome = await repository.save(profile);
      return outcome.kind === "saved"
        ? { profile, status: "saved" }
        : {
            reason: null,
            refusal: "name-taken",
            status: "refused",
            until: null,
          };
    },
    unlocksAt,
  };
}
