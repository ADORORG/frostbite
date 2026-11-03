# `@repo/configs`

The platform's typed configuration modules (`platform.ts`, `games.ts`, `features.ts`, `chains.ts`, `rate-limits.ts`, and the rest,
plus one file per game in `games/`), as a workspace package so every consumer imports them by name instead of by a long relative
path: `import { games } from "@repo/configs/games"`.

## Public API

- Every `<name>.ts` in this directory is `@repo/configs/<name>`, and `games/<id>.ts` is `@repo/configs/games/<id>` (one wildcard
  in `exports`). Add a module by adding the file; nothing is registered here.
- `src/modules.ts` `listConfigModules(directory)` lists the modules, for the tests.

## Dependencies and configuration

The modules read validated environment values and import workspace packages; they hold the policy values, never secrets. A
consumer lists `@repo/configs` in its `package.json` (`"workspace:*"`), like any workspace package.

## Invariants

- Business and environment values live here once; consumers do not copy them.
- Every module resolves through the package name to its own file (the integration test checks each one).
- No module imports a feature's internals: this package sits below the apps and above the packages.

## Tests

`pnpm --filter @repo/configs test:unit` (the module list), `test:integration` (each module resolves by name), `test:coverage`.

## Ownership

Platform engineering owns the modules; each policy value is owned by the area named in its file.
