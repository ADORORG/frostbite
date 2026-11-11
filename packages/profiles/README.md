# `@frostbite/profiles`

A player's profile: the name and preset picture they chose, and whether their public page is shown. This package holds the rules and the
storage; the pages and the HTTP routes belong to `@frostbite/feature-profiles`, which reads through it so a page can only show what was
checked here.

## Public API

- `createProfilesService({ clock, policy, repository })`: `get(userId)`, `save(userId, { avatar, name, visible })` (`saved`, or a refusal:
  `name-invalid` with a reason, `name-locked` with the time it unlocks, `name-taken`), `checkName(userId, name)` (`available`, `yours`,
  `taken`, `locked`, `invalid`), `getPublic(name)` (only a profile that is switched on), `remove(userId)`, `unlocksAt(profile)`.
- `createDrizzleProfileRepository(database)`: the PostgreSQL adapter for `ProfileRepository`.
- `nameProblem(name, policy)`, `nameKeyOf`, `normalizedForBlocklist`: the name rules. The shape check (`nameShapeProblem`) is in
  `@frostbite/shared/profiles`, so the form and the server run the same one.
- `assertProfilePolicy(policy)`: refuses a policy that cannot work (a bound outside the table's, a minimum above the maximum, a blocked
  word that is not lower case letters and digits).

## Invariants

- A name is letters, digits, `_` and `-`, starting with a letter or digit, within the deployment's length. It is the page's address.
- A name is unique on its lower case (`name_key`), so `Ada` and `ada` cannot both exist. The table's unique key settles two players who
  choose a name together: exactly one of them gets it. A hidden profile still owns its name.
- A name may not contain a blocked word once it is lower-cased, stripped of `_` and `-`, and its look-alike digits read as letters
  (`adm1n` is `admin`).
- A name may change only after the cooldown since it last changed (the first choice starts the clock). Changing only its capitals, the
  picture, or whether the page is shown is never held back.
- The page is opt-in: no profile, or one switched off, has no public view and no findable name. Nothing is copied from the account, so no
  email or wallet text can become a name.
- Deleting a profile, or the account (`ON DELETE CASCADE`), frees the name.
- The avatar is one of the preset ids in `@frostbite/shared/profiles`; there are no uploads, so nothing to moderate.

## Configuration

None of its own. The policy (`minLength`, `maxLength`, `changeCooldownDays`, `blockedTerms`) is supplied by the deployment
(`configs/profiles.ts`); the table's own bounds (`1..32` characters) are the ceiling of `maxLength`.

## Tests

`pnpm --filter @frostbite/profiles test:unit` and `test:integration` (real PostgreSQL: saving, the race for one name, the table's checks,
deleting with the account).

## Ownership

Platform accounts and games domain.
