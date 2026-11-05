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
  `@frostbite/wallet/client` (`useWalletChooser`), so a game asks for it without importing the accounts feature.
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
- `@frostbite/wallet`: chooser state in `WalletProvider`.
- `features/accounts`: balance contract, operation, source port, client store (`idle|loading|ready|refreshing|stale|
unavailable|failed`, 60 s only while the menu is open, answers for a replaced wallet dropped), `WalletRoot`,
  `WalletWidget`, `WalletMenu`, balance line, linked wallets, copy, chooser dialog; `balanceRefreshMs` in the wallet
  config; rate limit `getWalletBalance` 30 a minute.
- `@frostbite/game-sdk` and `features/games`: `wallet.connect` in protocol, host, client and the page; the dock's wallet
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
- Coverage (statements / branches / functions / lines): `@repo/ui` 99.4/98.6/100/100; `@frostbite/wallet` 100 on all four;
  `@frostbite/game-sdk` 98.3/98.0/98.3/98.4; `features/accounts` 95.6/96.4/92.9/95.8; `features/games` 98.7/96.0/97.9/99.1;
  SDK explorer 100/91.7/100/100; `apps/web` 96.9/96.6/96.0/97.5.
- e2e: the full suite, run without updating baselines after regenerating them: 372 passed, 0 failed, 92 skipped
  (project-specific skips). New: `wallet-widget.spec.ts` (every public page, reconnect and disconnect, balance asked
  only while open and honest, Escape and outside click); `wallet-sign-in.spec.ts` rewritten through the widget; the
  explorer spec covers `wallet.connect` in the real frame. The wallet specs ran three times in a row without a flake.
  134 baselines changed (the new header button); desktop and mobile images were inspected.

## Open

- Indexer choice (balance). Lazy loading (#59). W2-10B evidence still missing. The email adapter is not built.

## Owner testing, 2026-10-15: three defects found with a real wallet, and fixed

1. **After a reload the button said "Account" instead of the wallet.** The connection library waits about 1.5 s after
   load before it reconnects to the last wallet (it waits for extensions), then waits for the extension, so for a
   moment there really is no connected wallet. The button now says "Reconnecting wallet…" while the library has a
   remembered wallet (`hasRememberedWallet`, in `@frostbite/wallet/client`, reads the library's own `defaultWallet` key) and
   until `reconnectWaitMs` (10 s, in `configs/wallet.ts`) runs out. My e2e wallet answered instantly, so it could not
   show this; the fake wallet now has a delay option and the e2e checks the label and then the address.
2. **Signing out on `/account` kept showing the session.** Pages are rendered on the server and the widget changed only
   its own state. After a successful sign-in or sign-out the widget now calls `onSessionChange`; the app supplies
   `router.refresh()` (`apps/web/src/app/wallet-shell.tsx`), so the navigation and private pages follow at once and the
   menu keeps its state. A failed sign-in does not refresh. Disconnecting a wallet does not end the session (by
   design), so a signed-in person still sees the session after Disconnect; the button then says "Account".
3. **"Switch wallet" closed the menu and did nothing.** The chooser dialog closed itself whenever a wallet was
   connected, and one already was. It now closes when the choice is made: a wallet that was not connected when it
   opened is connected, a different wallet is connected, or the same one was chosen again and connecting finished.

Tests: unit tests for each (including a failed sign-in not refreshing), e2e for all three (reload with a slow wallet,
sign-in and sign-out following the page, Switch wallet), mutation proof (12 more guards; two survivors found and
fixed: a failed sign-in telling the page, and a test that read the library's storage key from the constant under test).
The e2e tests that sign in now have wallets of their own: sharing one account between tests running in parallel made the
suite intermittently fail.

## Owner testing, second round: the wallet flickered on every page change

Every link was a plain `<a href>`, so each click loaded the whole app again and the connection library, which waits before
it reconnects, showed "Reconnecting wallet" on every page. Shortening the wait would only have hidden it. The app now
moves between pages with the router (`apps/web/src/app/client-navigation.tsx`, deciding in
`apps/web/src/client-navigation.ts`), so the layout and the wallet connection live on. Pages are still rendered on the
server. Left to the browser: modified clicks, other targets, downloads, `rel=external`, other sites, `/api/` and
`/play/` paths, and jumps within the current page. A hard reload still shows the short "Reconnecting wallet" wait; that
is the library's.

Tests: unit tests for every rule of the decision function (11 mutations, all caught); e2e with a deliberately slow
wallet that marks the page, moves through four pages and back, and shows the page was never reloaded and the button
never showed anything but the address (it fails with the fix removed, which I checked by rebuilding without it); and a
check that a modified click and the skip link still behave as links.

Found while verifying: the rate-limit 429 integration test is intermittent (61 requests in a one-minute window can
straddle the boundary). Not from this change; filed as task #60.
