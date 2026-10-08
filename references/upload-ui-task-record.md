# W3-06 — Upload progress, retry, validation-error, and asset-library UI

Status: completed 2026-10-08; formal deep review Converged (see "Review")
Baselines: `1feeee8` (part 1), `53ddd0d` (part 2: signed reads and library API), `d367740` (part 3: UI and review)
Depends on: W3-02 through W3-05A (completed). Unblocks W3-07 and W3-08.

## Objective and done criteria

Let a signed-in user upload an image from the browser, see real progress, recover from failures, be told
plainly why a file was refused, and browse their private uploads with thumbnails. Done means: the flow
works in a real browser against real services (Postgres, S3-compatible storage, the worker, a signed
Inngest runtime); every state is explicit and truthful; the page meets the repository's responsive,
keyboard, reduced-motion, and accessibility matrix; R2 compatibility is documented with a script that
verifies a real bucket.

## Decisions

- **Local R2 stand-in:** the already pinned MinIO image, packaged as `@ador/test-kit/s3-runtime` (per-run
  credentials, buckets, CORS for the web origin, guaranteed cleanup). The R2 conformance suite now uses it.
- **Plain `http` only on loopback outside hosted environments:** one rule in `@repo/config/transport`,
  applied to `R2_ENDPOINT` and the Inngest base URL; path-style addressing for plain-http endpoints.
- **Signed reads (ADR-016, accepted by the user):** owner-only presigned GET for derivatives, 5-minute
  lifetime, with a documented migration plan to a streaming route and its triggers.
- **Library API:** `GET /api/v1/uploads/assets`, newest N (policy `libraryPageSize`, 48), no pagination.
  Storage outages degrade a tile to `derivativeAccess: "unavailable"` instead of hiding the asset.
- **UI architecture** (the user asked for small, reusable, pluggable parts): see below.

## Delivered design

- `@repo/ui` gained generic primitives only: `ArcadeActionButton`, `ArcadeSelect`, `ArcadeFileDrop`,
  `ArcadeProgress`, `ArcadeBadge`, `ArcadeMediaTile`, plus tokens-based CSS. Nothing upload-specific lives there.
- `features/uploads/src/client/` is framework-free and unit-tested in node: `api-client` (every response
  validated against the shared contract, typed errors), `file-checks`, `transfer` (an `ObjectTransfer` port
  with an XHR implementation), `upload-state` (a pure reducer with exhaustive states and events),
  `upload-runner` (resumable orchestration), `asset-poller`, `library-refresh`, copy modules keyed by the
  exhaustive reason/state unions, `client-policy`, and `browser-services` (the single bundle of browser
  dependencies, injected everywhere).
- `src/ui/hooks/` adapts that logic to React; `src/ui/components/` holds small presentational components;
  `uploads-workspace.tsx` is the only client boundary and composition root; `uploads-surface.tsx` is a
  server-rendered shell. The page is registered through the manifest (`/studio/uploads`, navigation entry),
  with the path defined once in `@ador/shared/uploads`.
- Retry reuses the attempt's idempotency key, so intent creation (which re-signs) and completion are safe
  to repeat, and a finished transfer is never repeated.
- Test and ops tooling: `@ador/test-kit` (`s3-runtime`, `service-process`, `png`), `withUploadServices` in
  the e2e package, a real-R2 smoke script (`pnpm --filter @ador/provider-object-storage-r2 smoke`) and the
  R2 checklist in that package's README.

## Findings and defects fixed

- **A real W3-02 bug, found by the browser e2e:** every fresh upload intent failed in production-like
  conditions with "Upload credential exceeds its persisted authorization expiry". The service signed for the
  whole remaining lifetime while the provider stamped a slightly later issue time, so the credential always
  outlived the authorization by a few milliseconds. Unit tests had frozen the clock and missed it. Fixed by
  measuring the lifetime at signing time and keeping a one-second margin; regression tests use a provider
  clock that runs ahead and a ticking service clock.
- A hook-level race: two rapid Retry actions could start two runs, and a defect inside a run left the screen
  "running" forever. Both fixed and mutation-proven.
- Parallel e2e specs that shared fixture users interfered through their sessions; every upload scenario now
  has its own user, and seeded actors are derived from the fixtures so a new one cannot be forgotten.
- The existing Week 2 snapshots changed because the shared navigation gained an "Uploads" link; the diff was
  inspected and only the navigation row differs.
- Silent server errors: the HTTP boundary turns any exception into a bare 500 with nothing logged. It cost
  real debugging time here. Handed off (see limits).

## Review-found defects fixed (formal deep review, 2026-10-08)

The review read every changed file line by line, mutation-tested the tests, and found these in addition to
the defects above. Each was fixed with a test that fails without the fix.

- **A pre-aborted upload never settled.** Per the XHR contract, aborting a request that was never sent fires
  no event, so cancelling between creating the intent and starting the transfer would leave the screen
  waiting forever. The unit-test fake had hidden it by firing `abort` unconditionally; it now behaves like
  the real object, and a test runs against a real XHR and a local HTTP server.
- **A hung service could hang teardown.** `startServiceProcess().stop()` waited forever for a process that
  ignores SIGTERM; it now kills it after a deadline. `withUploadServices` also stopped later services only
  if earlier stops succeeded, which could leak a container; every service is now stopped and the first
  failure is reported.
- **A time-bomb fixture in the W3-05A worker pipeline test.** It mixed a fixed 2026-10-06 date with the
  real clock, so it began failing on 2026-10-08 (the database enforces cleanup after expiry). All its
  timestamps now come from one clock reading.
- **A fixture that made the dom suite flaky under load.** The default fake library held an asset that never
  finished, so the library polled every millisecond and starved React's `act` on a busy machine. It
  reproduced deterministically under CPU contention (3 of 8 workspace tests) and now passes repeatedly
  under the same load; the default library is empty.
- **Gaps the mutation run exposed**, now tested: unmount aborts a running upload; retry after a cancel;
  late library responses and failures after a newer request; refresh timer cleanup; refresh on `finished`;
  the form disabled while busy; the file input reset for an empty selection; the PNG fixture's gradient.
- **Smoke script:** it stopped misleadingly after a failed presign and did not check that it cleaned up;
  both are fixed, and a missing `PUBLIC_BASE_URL` now says so.
- **Repository rules:** coverage thresholds of `features/uploads` and `packages/uploads` were 90, not the
  repository's 90.01 ("above 90"); the quality spec now matches the sibling spec (reduced-motion effect,
  real keyboard sequence via the skip link); duplicated byte-limit formatting is one helper; type
  assertions and `unknown` in tests and test support were removed; a test file over 300 lines was split;
  the feature README was brought up to date.

## Verification evidence (final tree, 2026-10-08)

| Gate                    | Result                                       |
| ----------------------- | -------------------------------------------- |
| `pnpm env:check`        | exit 0                                       |
| `pnpm format:check`     | exit 0                                       |
| `pnpm typecheck`        | exit 0 (includes test files)                 |
| `pnpm lint`             | exit 0 (includes the 300-line source policy) |
| `pnpm test:unit`        | exit 0                                       |
| `pnpm test:integration` | exit 0                                       |
| `pnpm test:coverage`    | exit 0 (per-workspace thresholds of 90.01)   |
| `pnpm db:check`         | exit 0                                       |
| `pnpm build`            | exit 0                                       |
| `pnpm test:e2e`         | 125 passed, repeated, against real services  |

Coverage of the packages this task owns: `features/uploads` and `packages/ui` 100% lines, branches,
functions, and statements; `tests/e2e` 100% lines and 93.75% branches (the one uncovered branch is the real
service launcher default, which only the end-to-end run exercises, and is commented as such). The longest
changed source or test file is 247 lines.

Browser flows on real services: upload → processed thumbnail that survives a reload; another user sees
nothing and anonymous calls get 401; a non-image is rejected with an explanation; a structurally valid but
undecodable image is reported unusable; an unsupported type never reaches the server; an interrupted
transfer is retried without starting over; the page requires a session. The quality spec covers every
viewport: overflow, reduced-motion effect, keyboard sequence, axe (WCAG 2.2 AA), and visual snapshots. A
probe of a real upload and reload recorded no console errors or warnings, page errors, failed requests,
or HTTP errors.

Mutation proof: about 100 deliberate breaks across the service margin, API client, file checks, transfer
(fake and real XHR), state machine, runner, poller, refresh scheduling, messages, hooks, workspace wiring,
the UI primitives, the e2e service teardown, the smoke script, and the shared shell; all killed after
adding tests for the survivors. Each new or changed test was proven by at least one of them.

## Review

Formal deep review (`deep-review-until-clean`) of the whole uncommitted W3-06 diff: **Converged**. Methods
used: whole-file read (M1), producer/consumer contract diff (M4), mutation proof (M5), house-rule audit
(M11), runtime observation (M7), execution-path walk (M3), dead-code proof (M10), convention conformance
(M9), coverage-hole walk (M6), adversarial input enumeration (M8), and hunk narration (M2). The final
three passes, over an unchanged tree after the last fix, were M6, M8, and M2, and found nothing.

## Known limits and handoffs

- **R2 itself is unverified.** Everything runs against MinIO. The smoke script and checklist are the
  verification to run with real credentials; the conditional-copy extension is a beta Cloudflare feature.
- No pagination (newest 48 only, flagged `truncated`). Private draft access rules and abandoned-upload and
  object cleanup are W3-07; signed URLs issued before a deletion keep working until they expire (ADR-016).
- Client size hints use the default upload policy at build time; the server stays authoritative if policy
  changes later.
- The "Uploads" navigation link appears for every authenticated user, matching W3-02, which allows any
  authenticated user to upload.
- Without the worker running, uploads stay "Checking" and the page says processing is taking longer; the
  worker and Inngest are not deployed (W8-06).
- The HTTP boundary logs nothing when an operation throws; add structured, secret-free error logging
  (W8-07) before any real deployment.
- Library polling signs every processed asset's renditions on each reload; that is cheap now and worth
  revisiting with pagination.
- The browser transfer sets no timeout, so a storage endpoint that accepts the connection and then stalls
  leaves the progress bar still until the user cancels; the presigned URL still expires server-side.
- Coverage holes that remain are outside this task: `packages/test-kit` (`inngest-runtime-api`,
  `s3-runtime`), `packages/uploads` (`drizzle-repository`), the R2 adapter's `create-adapter` and
  `r2-client` branches, and `packages/shared` `uuid-v7`. All packages remain above their thresholds.
- Dependency ranges in `features/uploads/package.json` (`^` for `@vitejs/plugin-react` and the React type
  packages) follow the other React features rather than the exact pins used in `packages/ui`; aligning the
  whole repository is a separate change.
- The `brand`, `homeHref`, and notice strings in `AppShell` are repeated literally in every feature surface,
  as in the existing ones; centralising them is a separate change.
