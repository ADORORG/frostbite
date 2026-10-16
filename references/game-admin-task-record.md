# Staff game administration (G7f)

Branch `feat/g7e-6-staff-game-admin`, stacked on `feat/g7e-5-alkanes-admin`. Tasks #80 (service and table) and #81 (page and routes), part of #73.
Decisions: ADR-018 Amendment 3 and its D22/D19 note (owner survey, 2026-10-16): 1 confirmation to complete on signet; "delayed" after
2 blocks of indexer lag or 60 minutes (decided, not built); any staff member may pause and resume, logged; a claimed milestone never
changes (the contract already refuses any second definition).

## What it is

- `@ador/game-admin`: service (`start`, `submitSigned`, `refresh`, `list`), repository over `ador.game_admin_steps`, README. Works through
  the neutral ports; tested on the simulated chain against PostgreSQL.
- `@ador/feature-game-admin`: four routes, two pages, client, panel (pause/resume, milestones with drawings, review, log).
- Shared, not copied: the transaction lifecycle (`canMove`, `afterObservation`, `afterBroadcast`, `moveTo`, `signedOf`, `stageOf`), the
  summary codec and the stored-row mapping moved to `@ador/shared/chain`; the table's columns and checks to
  `packages/database/src/schema/tracked-transaction.ts` (`game_milestone_claims` now uses them; `drizzle-kit generate` reports no change).
  `configs/game-rewards.ts` is the one place the chain and contracts are configured for claims and administration.
- `game:administer` capability, granted to the `staff` role.

## Verification

- Unit/DOM/integration tests per package (service 17, feature 58 unit + 4 integration, shared 29 lifecycle + contract + row tests);
  game-claims (41) still passes after the refactor.
- Mutation proof: service/repository 10 mutants (1 equivalent: the operation filter is redundant with the milestone filter), feature 11
  mutants, all killed after two tests were added.
- Playwright (`tests/e2e/tests/game-admin.spec.ts`, four viewports with axe, keyboard order, reduced motion and baselines): found and
  fixed a mobile overflow (a long chain id in an info card; `.arcade-info-card` now wraps anywhere) and a misleading answer
  ("not administered" where the truth was "no contract").
- Gates: see the final report of the session.

## Not built, and said so

- No wallet signs administration steps; staff paste a signed transaction (the page says so). Signing a `bitcoin-psbt-bundle` is the
  wallet package's work after qualification.
- No chain or contract is configured (`configs/game-rewards.ts`), so on the real stack every step answers "not available".
- The "delayed" display (decided) is not built, for players or staff.
- Publishing a template and creating a game are not on the page: they happen before a game has a contract; a game's contract is
  configured by hand after creation.
- The pause state shown is the log's, not read from the contract.
