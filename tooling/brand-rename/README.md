# `@repo/brand-rename`

The one command that renames the platform: the npm scope, the names built on it, and a check that nothing was missed. Not shipped, and
nothing in the platform imports it.

## Public API

- `pnpm rename:brand --scope @name --slug name --name Name [--dry-run]` rewrites every form of the old name in the tracked text files
  (the scope in imports and `package.json`; names such as `ador-game`, `ador-stack-postgres`, `ador-session`; storage keys
  `ador:game:<id>:...`; schema-qualified names `ador.table`; the verifier bundle's generated names; the display name) and prints, per rule,
  how many times it fired. With `--dry-run` nothing is written.
- `pnpm rename:brand --check` writes nothing and exits with a failure if the old name still stands anywhere outside what is meant to stay.
- `runRename`, `findRemaining` (`src/rename.ts`) are the same, with the folder given, so a test can run them on a copy.

The old names are listed once, in `src/brand.ts`; the rules built on them are in `src/rules.ts`.

## Invariants

- It only reads and writes files git tracks, and only text (no NUL byte in the first 8 KiB).
- It never touches the lock file, the migration snapshots or the migrations themselves, or its own folder (`src/files.ts` says why). The lock
  file and the snapshots are made again by their own tools; a schema is renamed by a new migration, not by editing the ones already applied.
- Forms that are meant to stay are set aside by name (`src/rules.ts`): the GitHub organisation (`ADORORG`, `adororg`) and the versioned
  protocol constants (`ADOR_ALLOWLIST_LEAF_V1`, `ADOR_CLAIM_ACTION_V1`: the domain separation of a hash and of a signed message, shared with
  a Rust spike), which change every allowlist root and every signed message if they are renamed.
- A form it does not know how to rewrite is reported with its file and line, and the command fails; it is never left silently.
- A second run changes nothing. A new name that contains the old one is refused before anything is written.

## After a rename

The tool does not run these; each has a tool of its own:

1. `pnpm install` (makes the lock file again).
2. A new migration that renames the database schema, and the migration snapshots made by `drizzle-kit generate`.
3. The games' pinned verifier digests, which change when the generated names in the verifier bundle change
   (`pnpm --filter @repo/web exec vitest run test/games-verifiers.unit.test.ts` prints the value to pin).
4. `pnpm rename:brand --check`, then the repository's gates.

## Test commands

`pnpm --filter @repo/brand-rename test:unit`, `test:integration` (runs the rename on a throwaway git repository), `test:coverage`.

## Ownership

Platform engineering. If a new kind of name carrying the old brand is added (a cookie, a key, a package), add its rule here with a test.
