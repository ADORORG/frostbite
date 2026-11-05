# Shared vitest configuration (#66)

Branch `chore/shared-vitest-config`, stacked on `feat/library-pagination`; baseline `2383f9b`. Split from #17.

## What changed

- New workspace `@repo/vitest-config` (`packages/vitest-config`): `packageVitestConfig(options)`; README lists the options.
- 43 workspaces' `vitest.config.ts` now call it (each file 25 to 51 lines before, 5 to 12 after; 1 224 lines removed, 321 added in
  total, most of the added being `package.json` and the new package). Each gained the `@repo/vitest-config` dev dependency.
- Three kept their own file, each named with its reason in `test/adoption.integration.test.ts` (`client-react`,
  `typescript-config`, `eslint-config`).
- The `all: true` coverage option some files carried is gone: vitest 4 no longer has it (coverage covers the `include` globs).

## How equivalence was shown

A script loaded every old config (from git, in place so imports resolve) and every new one through vite's config loader and
compared the resolved objects, ignoring key order and the root `environment` (which inline projects do not inherit): **0 of 43
differ** after one fix. The first comparison found a real error in my first generation: `features/creator-admission` ran its
projects in jsdom under a root `environment: node`, and the first output made them node; it is jsdom again.

## Verification

- Mutation proof on the builder and the adoption test: 11 breaks (floor, plugin, tsconfig paths, parallelism, timeout on the wrong
  project, environment, dom setup file, wrong suffix, exclude, threshold override, a workspace leaving the shared config); first run
  left 2 alive (`react: false` and `tsconfigPaths: false` were not tested), a test was added, all 11 killed.
- `@repo/vitest-config` coverage 100/100/100/100 (9 statements, 20 branches).
- `pnpm format:check`, `pnpm lint` (47 workspaces, repository policy), `pnpm typecheck` (47 tasks): passed.
- Full `pnpm test:coverage` through the new configs: see the end of this file.

## Found on the full coverage run

`@frostbite/test-kit` failed its own branch threshold (88.65% against 90.01%) with a config that resolves identically to the old one,
so the failure predates this change: two fixtures added with the claim path (`adder-game.ts`, `memory-game-backend.ts`) were
only exercised from other packages' suites. Tests were added in the package (`memory-game-backend.unit.test.ts`,
`adder-game.integration.test.ts`; 6 mutations, all killed); branches are now 96.9%.
