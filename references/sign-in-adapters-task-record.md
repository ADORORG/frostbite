# Sign-in identity adapters and wallet sign-in (SDK-G)

Branch `feat/sign-in-adapters`, on top of `feat/game-milestone-progress`; baseline `8863e88` (plan commit).
Plan: `docs/product/plan-sdk-g-sign-in.md` (approved 2026-10-13 with the defaults). Owner decisions are in
`docs/product/game-sdk-roadmap.md` (surveys 10 and 11).

## Decisions taken on the documented defaults (review at merge)

- **No test-only sign-in route in the app.** The real wallet path runs in e2e with a deterministic fake UniSat
  extension that signs with test keys (`tests/e2e/tests/support/fake-wallet.ts`, keys in `testWallets`). Nothing in the
  production bundle can mint a session.
- **A removed wallet is held for 24 hours** (`releaseHoldMs`, `configs/wallet.ts`). During the hold nobody can sign in
  with it or link it, except the account that removed it.
- **Sign-out ends only the current session.** Removing a method signs out every other session.
- **Removal needs a recent session** (the passkey window) and **never removes the last way in**; both are enforced in
  the repository transaction, not only the page. One shared rule (`removalOutcome`) serves wallets and passkeys.
- **A wallet on another account is refused without saying whose** (`identity-conflict` surfaces as "This wallet cannot
  be used for that."), and is told apart from a bad signature only to the signed-in owner flow.
- **A link or step-up challenge cannot sign anyone in**: `verify` requires the expected action and, for link and
  step-up, the expected account.
- **`/connect` and the qualification tooling are removed** (the app is not public: no compatibility shim). The
  physical-evidence tool is gone; W2-10B stays `blocked` until the owner supplies an evidence record.
- Interim UI: the page `/sign-in` and the same panel on `/account`; a public "Sign in" navigation entry. The header
  widget (SDK-F, #55) replaces them.

## What was built

- Database: security-action values `wallet-linked` and `wallet-unlinked`, table `released_wallets` (its own schema file),
  migrations `wallet_release_hold` and `drop_wallet_qualification`.
- `@ador/auth`: `methods/rule.ts`, wallet methods service and Drizzle repository (advisory lock, locked recent session,
  hold, events), session `revokeById`, `verify` guards, routes and schemas for the nine wallet endpoints, shared
  session-lock helper.
- `@ador/http` and the web adapter: effect `clear-platform-session` (cookie cleared with max-age 0).
- `features/accounts`: nine operations, wallet policy config with validation, client store (`createWalletSession`) with
  one action at a time and signatures dropped when the wallet changes, hook, picker, panel, sign-in page.
- Removed: `features/wallet-connection`, `packages/auth/src/qualification`, `packages/shared/src/auth/qualification.ts`,
  the qualification schema, tests and e2e.

## Verification (run on this branch)

- Mutation proof: 16 guarded behaviours broken one at a time and restored (the rule, missing and kind checks, recency
  and future-dated sessions, verify action guard, stale-session guard in the repository, last-wallet removal, session
  revocation, hold expiry, link event, generic conflict, sign-in action, sign-out, client wallet-change and busy
  guard). 14 were caught first time. Two survived and were fixed: the verify action guard (its test is an integration
  test; the first run used only unit tests) and the repository's stale-session guard (a new integration test signs the
  session out after the request loaded it). Both caught on the re-run. A leftover mutation from an interrupted earlier
  run was found in the tree and restored before this run. The new navigation entry was also mutation-checked.
- `pnpm format:check`, `pnpm lint` (44 workspaces, 1333 files) and `pnpm typecheck`: passed.
- `packages/auth` coverage: 88 tests; statements 97.19%, branches 95.67%, functions 100%, lines 98.97%.
- `features/accounts` coverage: 74 tests; statements 94.7%, branches 93.3%, functions 92.22%, lines 94.89%.
- Browser: `wallet-sign-in.spec.ts` (5 tests: sign-in, reload, sign-out, host-only httpOnly cookie; a wallet on another
  account refused generically; link, remove and the hold; last wallet not removable; a link challenge cannot sign in).
  Full e2e after regenerating 40 baselines (header label "Connect" became "Sign in"; a diff image was inspected):
  367 passed, 0 failed, 77 skipped (project-specific skips).
- Not re-run after this stretch: web, database, shared and games workspace suites (unchanged by it; they passed on
  earlier commits of this branch).

## Open

- W2-10B evidence (wallet names, versions, tests) has not been supplied; the row stays `blocked`.
- The email adapter is designed for, not built (placeholder `*.wallet.invalid` addresses must read as "no email").
- CSP: see findings S39.
