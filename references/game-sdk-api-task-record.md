# Game SDK API v1 additions, the explorer game and the installable package

Branch `feat/game-sdk-api-v2`, on top of `feat/game-arcade-redesign` (`8cc5fd3`). Owner request (2026-10-13): make
sure embedded games can talk to the platform through the API, add more of it so builders can use it, expose the
wallet address only (the game has no network, an address is public), document items 1 to 7 so they can be tracked,
build what can be built now, and make the SDK standalone and installable.

## Decisions taken on the documented defaults (review at merge)

- **Additive only.** Result schemas are strict in the SDK, so adding a field to an existing result would break
  every game already built on it (FROST·BITE). Everything new is a new method or event. Recorded as a rule.
- **Wallet address is gated by the manifest's existing `wallet` capability.** A game that did not declare it gets
  `permission_denied` and no wallet event; the page's "What it asks for" now says which declared capabilities the
  platform actually grants ("Available") and which are only declarations. The wallet provider is mounted only for a
  game that declared `wallet`, so other games carry none of it.
- **Not built (needs the owner):** display name, avatar, player id (no profile exists); scores and leaderboards
  (server table, abuse rules); milestone progress and repeatable claims (changes the saved shape); wallet actions
  such as signing (blocked on G6, G7 and wallet qualification). `ui.fullscreen.request` was not built because a
  message from a frame is not a user action. All listed with reasons in `docs/product/game-sdk-roadmap.md`.
- **Package:** `private` and `UNLICENSED` stay until the owner chooses scope, licence and registry. Packing is
  real and verified; publishing is a decision.

## What was built

- Protocol: `wallet.get`, `capabilities.get`, `ui.toast`; events `wallet.changed`, `lifecycle.changed`,
  `fullscreen.changed`; error code `permission_denied`; `toastCallsPerMinute` policy; `requiredCapability` and
  `requiredEventCapability` tables.
- Host: `services` (wallet, toast), `push` and `emit`; capability gate; `rate-limit.ts` and `attach.ts` split out so
  `host.ts` stays under 300 lines (`./attach` is a new entry). Client: `wallet`, `capabilities`, `ui.toast`, `on`.
- Platform page: `WalletGamePlayer` (wallet provider only for a game that asks), `WalletCard` and a "Wallet" dock
  section, game's toast shown under the game's name, `use-host-events` (tab hidden, full screen), capability
  "Available / Not available yet" badges, `GameWalletConfig` from `configs/wallet.ts`.
- SDK explorer game (`games/sdk-explorer`, development only): a button per call, a log, an event list.
- Package: `build:package` (tsc to `dist`), `publishConfig.exports`, `files`, only `zod` as a dependency, `esbuild`
  an optional peer, an integration test that the built package resolves nothing from this repository.
- Docs: roadmap (new), interface Amendment 2, onboarding guide, SDK and feature READMEs.

## Evidence

- `pnpm lint` (45 tasks, cargo fmt/clippy, repository policy), `pnpm typecheck` pass. Coverage: game-sdk
  99.48/97.76/100/99.71, feature-games 98.62/95.65/97.82/98.97, test-kit 99.11/96.62/98.27/99.43, sdk-explorer
  thresholds met. Web unit 54 and integration 46 pass.
- Mutation: 19 mutants of the new guards (permission check, event capability, toast limit, ready guard, event
  validation, inherited event names, handler removal, wallet strictness, external-game grant, address validation,
  disconnected wallet, fullscreen target, lifecycle mapping, toast label, wallet read-at-ask, provider selection),
  all killed; sources restored.
- Full e2e: 363 passed, 53 skipped by design, 4 failed on the expected games-list snapshot (a new development
  game is listed); regenerated, re-run stable (16 passed). The explorer's own spec: five desktop tests in the real
  frame (every call, the toast, the wallet dock, tab hidden, an undeclared wallet refused).
- Package: the packed tarball (`pnpm pack`) installed with pnpm into an empty project, type-checked with the
  consumer's own settings (`skipLibCheck: false`) and run: ready, `wallet.get`, an event, 9 methods and 3 events.

## Known gaps

- A real wallet was not connected: the wallet library is tested through its reported state, and the return trip
  from the connection page is unverified. The formal three-pass convergence review was not run.
- The wallet library evaluates code, which the (report-only) CSP flags on `/connect` and now on a wallet game's
  page. Enforcing the policy would break wallet connection. Pre-existing; logged as a finding.
- No local development host for builders yet (SDK-E).
