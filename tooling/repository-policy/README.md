# `@repo/repository-policy`

Executable repository invariants for The Well. The package validates workspace test scripts,
handwritten source-file limits, architectural import boundaries, and decision-gate documentation.
It also combines workspace coverage summaries and LCOV records into a root report while enforcing
greater-than-90% line and branch coverage per workspace and in aggregate.

Run `pnpm repository:check` for static policies, `pnpm decision:check` for the decision catalog,
and `pnpm repository:coverage` after workspace coverage reports exist. Root and CI commands invoke
these gates automatically.

The import-boundary policy also keeps chain-family code and vendor SDKs (`@ador/chain/bitcoin`,
`/bitcoin-alkanes`, `/alkanes`, `bitcoinjs-lib`, `@alkanes/*`, `@omnisat/*`) inside `packages/chain/`,
`providers/chain/`, `packages/wallet/`, and conformance tests; `packages/auth/` is a recorded exception
until sign-in moves to the neutral address codec (ADR-017). Everything else uses the neutral ports.

## Sentences are written once

`src/sentence-policy.ts` fails `repository:check` when a user-facing sentence (a capitalised double-quoted literal of five words or more that
ends in `.`, `?` or `!`) is written in more than one place in production source (`features/*/src`, `packages/*/src`, `apps/web/src`). Write it
once and share it. Duplicates that existed when the check was added are in `sentence-baseline.json`; the check refuses a baseline that allows
more copies than there are, so it can only shrink. After removing a duplicate, run `pnpm --filter @repo/repository-policy update-sentence-baseline`.

## Ownership

Platform engineering.
