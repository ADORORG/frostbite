# The wallet widget (SDK-F)

Branch `feat/wallet-widget`, on top of `feat/sign-in-adapters`; baseline `f96611d`. Plan:
`docs/product/plan-sdk-f-wallet-widget.md` (built on the documented defaults while the owner was away). Owner
decisions are in `docs/product/game-sdk-roadmap.md` (surveys 4-11).

## Decisions taken on the documented defaults (review at merge)

- **No balance source exists, so the balance says so.** The indexer is an open decision gate and the repository
  forbids inventing provider values. The route `POST /api/v1/wallet/balance` and the widget are complete; the platform
  passes `null` as the source (`configs/features.ts`), so the widget shows "Balance unavailable: no data source is
  configured" and never a figure it did not get. **Owner decision needed: which indexer and endpoint(s).** The port
  (`BalanceSource`, with `accepts` and `satoshis`) leaves address validation to the adapter, because the repository
  policy forbids a feature importing chain-family code. A POST carries a read because operations take JSON bodies;
  answers are 200 with `ready` or `unavailable` (no new HTTP codes).
- **One mount for the whole app.** The layout wraps every page in `WalletRoot` (connection library, header widget,
  chooser dialog); `@repo/ui` gets a generic header slot so no page repeats it. The chooser's open/close state lives in
  `@ador/wallet/client` (`useWalletChooser`), so a game asks for it without importing the accounts feature.
- **The wallet library now loads on every page** (accepted by "every page"). **Measured: its chunk is about 604 KB
  gzipped**, the largest in the app by far. Follow-up task #59 (lazy-load it).
- **`wallet.connect()`** is an additive protocol method behind the `wallet` capability and a `connectCallsPerMinute`
  policy (default 6); it answers `requested`, `already-connected` or `unavailable`; the outcome reaches the game as
  `wallet.changed`. Games no longer mount their own provider.
- **The interim `/sign-in` page, its nav entry, the panel on `/account` and the public-page capability are removed**
  (app not public: no redirect). A person with only the account page now has one link to it, not a one-item menu.
- **Network mismatch:** a warning on the header button and in the menu (platform network) and on the game's wallet
  card (the game's expected network). The player may continue.
- **Auto-reconnect** is the connection library's own behavior; the e2e suite proves it (reload keeps the wallet,
  another tab reconnects, Disconnect forgets it).
- The dialog row is a plain `div`, not a `<header>`: axe flagged a second banner landmark because the dialog is
  rendered inside the page header.

## What was built

- `@repo/ui`: `Avatar` (deterministic 5x5 mirrored grid from any text), `ArcadeDialog` (controlled), `ShellSlotsProvider`
  and the header slot in `AppShell`, widget styles.
- `@ador/wallet`: chooser state in `WalletProvider`.
- `features/accounts`: balance contract, operation, source port, client store (`idle|loading|ready|refreshing|stale|
unavailable|failed`, 60 s only while the menu is open, answers for a replaced wallet dropped), `WalletRoot`,
  `WalletWidget`, `WalletMenu`, balance line, linked wallets, copy, chooser dialog; `balanceRefreshMs` in the wallet
  config; rate limit `getWalletBalance` 30 a minute.
- `@ador/game-sdk` and `features/games`: `wallet.connect` in protocol, host, client and the page; the dock's wallet
  card opens the app's chooser and shows the mismatch; the SDK explorer has a probe.
- Docs: plan, interface doc, onboarding, SDK/accounts/wallet READMEs, preview checklist, ledger note.

## Verification (run on this branch)

- Mutation proof: 21 guards broken one at a time and restored; all 21 caught (balance never zero for no source,
  impossible and fractional values refused, address acceptance asked of the source, no asking while the menu is
  closed, polling stops, late answers for an old wallet dropped, old figure not carried to a new wallet, a failure keeps
  the older figure marked older, mismatch warning, Escape, last wallet not removable, failure not shown as zero,
  connect rate limit, already-connected not reopened, capability needed, chooser dismiss, avatar mirror, dialog close,
  game card mismatch). The working tree was identical before and after. The guard changed by the policy fix
  (`accepts`) was re-checked separately.
- `pnpm format:check`, `pnpm lint` (44 workspaces, 1362 files, repository policy included) and `pnpm typecheck`: passed.
- Coverage (statements / branches / functions / lines): `@repo/ui` 99.4/98.6/100/100; `@ador/wallet` 100 on all four;
  `@ador/game-sdk` 98.3/98.0/98.3/98.4; `features/accounts` 95.6/96.4/92.9/95.8; `features/games` 98.7/96.0/97.9/99.1;
  SDK explorer 100/91.7/100/100; `apps/web` 96.9/96.6/96.0/97.5.
- e2e: the full suite, run without updating baselines after regenerating them: 372 passed, 0 failed, 92 skipped
  (project-specific skips). New: `wallet-widget.spec.ts` (every public page, reconnect and disconnect, balance asked
  only while open and honest, Escape and outside click); `wallet-sign-in.spec.ts` rewritten through the widget; the
  explorer spec covers `wallet.connect` in the real frame. The wallet specs ran three times in a row without a flake.
  134 baselines changed (the new header button); desktop and mobile images were inspected.

## Open

- Indexer choice (balance). Lazy loading (#59). W2-10B evidence still missing. The email adapter is not built.
