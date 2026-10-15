# `@repo/typescript-config`

The shared TypeScript compiler settings for every workspace, so strictness is decided once.

## Public API

- `base.json`: strict settings for libraries and tools (`NodeNext` modules, `isolatedModules`, `allowImportingTsExtensions`,
  declaration output, `noUncheckedIndexedAccess`).
- `react-library.json`: `base.json` plus `jsx: react-jsx` for React packages.
- `nextjs.json`: `base.json` with bundler module resolution and the Next.js plugin, for the web app.
- `src/config-contract.ts`: `hasStrictSafety` (`strict` and `noUncheckedIndexedAccess` are on) and `inheritsBase` (the config
  extends `base.json`), which the test applies to each config.

A workspace extends one of these in its own `tsconfig.json`; it may add paths and includes but must not turn strictness down.

## Invariants

- `strict` and `noUncheckedIndexedAccess` stay on in `base.json`, and the other configs extend it; the unit test fails if not.
- `any`, unchecked assertions and `@ts-ignore` are policy matters (`AGENTS.md`), enforced by the lint config, not here.

## Tests

`pnpm --filter @repo/typescript-config test:unit` (the options each config must hold), `test:integration` (a fixture project
type-checks against the configs), `test:coverage`.

## Ownership

The platform owner. Loosening a setting needs a recorded reason.
