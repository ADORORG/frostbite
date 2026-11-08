import { profileNameCeiling } from "@frostbite/shared/profiles";

// What bounds a profile name, as values the deployment supplies (`configs/profiles.ts`): how short and long it may be, how long a player
// must wait to change it again, and the words it may not contain. Nothing here is a constant of the platform.
export interface ProfilePolicy {
  // Words (lower case, letters and digits only) a name may not contain, once it is lower-cased, stripped of `_` and `-`, and its look-alike
  // digits are read as letters (see `normalizedForBlocklist`).
  readonly blockedTerms: readonly string[];
  readonly changeCooldownDays: number;
  readonly maxLength: number;
  readonly minLength: number;
}

// Refuses a policy that cannot work, at start: a bound outside what the table allows, or a minimum above the maximum.
export function assertProfilePolicy(policy: ProfilePolicy): void {
  const { changeCooldownDays, maxLength, minLength } = policy;
  const whole = (value: number) => Number.isInteger(value);
  if (
    !whole(minLength) ||
    !whole(maxLength) ||
    minLength < 1 ||
    maxLength > profileNameCeiling ||
    minLength > maxLength
  )
    throw new Error(
      `A profile name's length must be whole numbers with 1 <= min <= max <= ${String(profileNameCeiling)}.`,
    );
  if (!whole(changeCooldownDays) || changeCooldownDays < 0)
    throw new Error("The name change cooldown must be a whole number of days.");
  if (policy.blockedTerms.some((term) => !/^[a-z0-9]+$/u.test(term)))
    throw new Error(
      "A blocked term must be lower case letters and digits only.",
    );
}
