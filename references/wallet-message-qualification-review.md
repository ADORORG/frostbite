# W2-10B message qualification — verification ledger

Status: in progress; not converged
Date: 2026-10-04
Baseline: `828b3dcd34b79258066fa20f4b53cc4542ee6ff7` (clean working tree)
Branch: `feat/wallet-message-qualification`
Authority: implement and repair the approved qualification-only mode within W2-10B.

## Scope and risks

Scope includes shared wire contracts, explicit feature/operation registration, wallet boundary,
server diagnostic service, separate challenge schema/migration, HTTP origin protection, browser
lifecycle/UI, and corresponding tests. Existing components and strict BIP-322 verification are
reused; no third-party dependency/version was added. Workspace dependencies were linked through
pnpm. Generated SQL/snapshot and pnpm lockfile are generated artifacts, not handwritten source.

No session/identity creation, PSBT construction/signing, broadcasting, or conformance activation is
part of this diagnostic mode. Actual installed-wallet evidence remains an external gate. Public
release requires rate limits and challenge cleanup, not merely this internal test surface.

## Implementation verification so far

- Real PostgreSQL coverage: auth 79 tests, 96.91% statements, 96.12% branches, 100% functions,
  98.51% lines. New qualification service/repository have no reported uncovered branches.
- Wallet adapter: 72 tests; 100% statements, branches, functions, and lines.
- Feature: 33 tests; 98% statements, 97.05% branches, 100% functions and lines.
- Shared contracts: 72 tests; 100% statements/functions/lines, 97.64% branches.
- Web: 33 tests; 100% statements/functions/lines, 98.24% branches.
- Shared UI: 10 tests; 100% coverage in all dimensions.
- Production web build passed. Migration drift check passed against generated schema history.
- Focused Playwright: 12 cases passed across mobile/tablet/desktop/wide. Deterministic UniSat
  transport exercises actual challenge issuance, real BIP-322 signing, server verification,
  rejection/retry, replay failure, no session cookie, keyboard activation, axe, reduced motion,
  and visual baselines. This is not evidence for a physical wallet/browser combination.

## Corrections during implementation

- OpenAPI rejected a branded UUID transform in the wire schema. The schema now reuses the existing
  UUIDv7 text contract, with branding/validation performed in the server domain boundary.
- React lint rejected ref writes during render. Wallet state capture now updates in a layout effect;
  unmount invalidates pending work and prevents late verification/status changes.
- Pinned UniSat defaults can select another signing scheme. The normalized wallet adapter now
  explicitly requests LaserEyes `bip322`, mapped by Core 0.0.85 to `bip322-simple`; no fallback.
- Full-page axe found the shared marquee outside a landmark. A regression assertion failed before
  repair; the shared shell now gives the existing named marquee a region role. UI tests and focused
  browser checks passed afterward, without suppressing accessibility rules.
- The full wallet integration command exposed fixture configuration drift: the production package
  permits `.ts` imports but its standalone Next.js fixture did not. The fixture now inherits the
  shared Next.js TypeScript configuration. Its temporary `.next-qualification` directory is ignored
  so formatting does not race generation/removal of compiler-owned files.
- The instrumented whole-repository policy scan exceeded Vitest's five-second unit default under
  concurrent workers. Only that integration project now has a bounded 30-second budget. Its
  assertions and coverage thresholds are unchanged; the integration suite passed afterward.
- The verification response type is inferred from its strict shared schema, rather than maintaining
  a parallel interface. The provider string bound lives beside the other diagnostic wire bounds.
- A subsequent concurrent build/browser/coverage run exposed the same five-second limitation in
  the registration test's real entrypoint import. That one test now has a bounded 30-second budget,
  retaining the real import and manifest assertions. Final coverage is rerun after browser work,
  rather than treating an unmodified retry as evidence. The new React UI suite explicitly declares
  its `act` environment.

## Repository gate evidence

Commands run from `the-well` (logs retained under `/tmp/wallet-qualification-*`):

| Command                                             | Observed outcome                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm env:check`                                    | Passed for 13 environment-consuming workspaces                   |
| `pnpm typecheck`                                    | Passed, including tests and Rust contract checks                 |
| `pnpm lint`                                         | Passed, including Rust lint and repository policy                |
| `pnpm format:check`                                 | Passed                                                           |
| `pnpm test:unit`                                    | Passed for 27 workspaces                                         |
| `pnpm test:integration`                             | Passed, including disposable PostgreSQL and Rust/WASM tests      |
| `pnpm test:coverage`                                | Passed after scan-budget repair and Docker permission escalation |
| `pnpm build`                                        | Passed                                                           |
| `pnpm --filter @frostbite/database migration:check` | Passed; no schema drift                                          |
| Full Playwright suite                               | 114 passed, six skipped; not physical extension evidence         |
| `git diff --check`                                  | Passed                                                           |

Merged JavaScript/TypeScript coverage: 98.50% statements, 96.73% branches, 99.33% functions,
99.15% lines. Rust coverage: 94.55% regions, 100% functions, 98.99% lines.
The repository-policy command passed the 300-line source/test limit. Generated migration snapshot,
lockfile, and screenshot fixtures are explicitly exempt. No migration was applied to the user's
configured database. A sandbox-only Docker denial was resolved with permission escalation; it
was not classified as a product defect.

## Review state

The complete line-by-line audit, remaining mutation proofs, and required method rotation are pending.
No clean-pass streak or Converged verdict is claimed. Physical extension evidence remains unavailable
in this automated environment. Do not commit,
mark W2-10B complete, enable wallets, or advance to W3-04 on the strength of the figures above.

## External evidence required

For Oyl, Xverse, and UniSat: exact extension version, browser/version, OS/device category, network,
address type, approval/rejection, server-verification outcome, and account/network change outcomes.
Use `/connect` after applying the migration. Record only metadata, time, and outcome—not addresses,
signatures, private keys, seed phrases, or wallet profiles. PSBT/Alkanes physical evidence remains
separate and signing is still gated.
