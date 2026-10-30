# `@repo/game-tools`

Developer tooling for games. Not shipped, and nothing in the platform imports it.

## Public API

- `pnpm game:new <id> [--title "My Game"]` makes a new game from the template (`tooling/game-tools/template`) and
  registers it: a folder `games/<id>` (package `@game/<id>`), a manifest `configs/games/<id>.ts`, and one import
  and one list entry in `configs/games.ts` above the `game:new` markers. The new game already passes the
  platform's conformance check; the author then replaces the rules, the page and the milestones.
- `scaffoldGame({ id, paths, title })` (`./scaffold`) is the same, with the paths given, so it can run on a copy.

## Invariants

- Every input is checked before anything is written: the id must be a game id (`gameIdSchema`), the title 1 to
  80 characters, nothing may already exist under that name, and the registry must still have its two markers.
  Any refusal changes nothing.
- It copies the template and renames it; it never edits another game or the platform's code.
- Registration stays explicit and visible in a pull request: two lines in `configs/games.ts`.

## Test commands

`pnpm --filter @repo/game-tools test:unit`, `test:integration` (runs the generator on a copy of the template and
the conformance check on what it made), `test:coverage`.

## What the starter does not have yet

The starter game (`template/game`) predates the SDK's sound, keys, pause and run loop (see `docs/product/game-onboarding.md`, "Sound, keys, pause and a
steady layout"). A game made from it should be brought up to the pattern in `games/bro-maria`; making the generator write that pattern is filed
with the game-building skill (SK-1).

## Ownership

Platform games team. If the template's layout changes, the generator's tests fail until it follows.
