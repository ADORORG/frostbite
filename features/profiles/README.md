# `@frostbite/feature-profiles`

A player's profile as the platform shows it: where they set it up (`/profile`), the public page (`/p/<name>`), and the API routes behind
both. The rules and the storage are in `@frostbite/profiles`; this feature adds the pages and reads a player's records for the public page.

## Public API

- `createProfilesFeature(games, chains, policy, share?)` (the package's entry): the feature registration. One line in
  `configs/features.ts`; removing it removes the pages and routes and nothing else.
- Routes (all in `@frostbite/shared/profiles`): `GET /api/v1/profile` (own profile and the name rules), `GET /api/v1/profile/name`
  (is this name free: a hint), `POST /api/v1/profile` (save), `POST /api/v1/profile/delete`, and the public `GET /api/v1/profiles`
  (by name). Own-profile routes need a session; the owner is the session, never a field of the request.

## What the public page shows

The name, the preset picture, when they joined, **the best score the platform's own replay reached in each game** (`game_runs.score`,
verified runs only, never one a game reported), and the milestones they have minted (completed claims). Nothing else: no wallet, email or
account id. A record of a game the platform does not list is left out. Pictures of minted milestones come from the public gallery route.
A name nobody shows, a hidden profile and a name that cannot be one all answer "not found" alike.

## Design

The two pages follow the arcade design (`ADR-010`): a **player card** (one component, the live preview on the setup page and the hero of
the public page, lit in its picture's colour), three short stages (fighter, name, whether the page is shown) with one Save, high scores as
little cabinets over the game's picture, and the minted milestones as a shelf. The twelve avatars are pixel sprites drawn from data in
`@repo/ui` (`avatar-sprites.ts`), keyed by the ids in `@frostbite/shared/profiles`; a test fails if the two lists drift apart. Every
sentence is in `src/domain/copy.ts`.

## Configuration

The deployment's profile policy (`configs/profiles.ts`) and the share configuration (`configs/share.ts`, optional: without it there is no
Share button). Rate limits are in `configs/rate-limits.ts`.

## Tests

`pnpm --filter @frostbite/feature-profiles test:unit` and `test:integration` (the operations, the loader against real PostgreSQL, and the
pages in a DOM). The end-to-end flow is `apps/web/test/profile-flow.integration.test.ts`.

## Ownership

Platform accounts and games domain.
