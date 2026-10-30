# `@repo/eslint-config`

Shared flat ESLint presets for TypeScript, React, Next.js, and Turbo environment-variable checks.

## Purpose

One set of rules for every workspace: ESLint's recommended rules, typescript-eslint's recommended rules (which include no explicit `any` and no
unused variables), and a Turbo check that environment variables a task reads are declared. Prettier owns formatting, so its conflicting rules are
turned off. Generated build and coverage directories are ignored centrally. Consumer packages keep
warnings at zero (`--max-warnings 0`) and expose their own `lint` scripts so the root Turbo gate covers every workspace.

## Public API

- `@repo/eslint-config/base`: the base TypeScript preset every workspace extends.
- `@repo/eslint-config/next-js`: the base plus the Next.js and React rules, for `apps/web`.
- `@repo/eslint-config/react-internal`: the base plus the React rules, for UI packages and features.

A workspace's `eslint.config.mjs` is usually one line: `import { config } from "@repo/eslint-config/base"; export default config;`.

## Dependencies

ESLint and its plugins (`@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, the React hooks, Next.js and Turbo plugins). Their versions
are pinned here and nowhere else.

## Configuration

None at run time. A rule that must differ for one folder is turned off in that workspace's own config with a comment saying why.

## Invariants

- A preset change that makes an existing workspace fail is a change to that workspace in the same commit.
- Prettier owns formatting; no formatting rule is enabled here.
- The repository's stricter code rules (no unchecked assertions, 300-line files, no duplicated sentences) are not lint rules; `pnpm repository:check`
  and review enforce them.

## Tests

`pnpm --filter @repo/eslint-config test:unit` (the base preset), `test:integration` (the presets against sample code), `test:coverage`.

## Ownership

Platform engineering.
