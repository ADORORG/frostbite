# Plan: the wallet widget (SDK-F, task #55)

Status: **building on the documented defaults** (owner away, 2026-10-15). Branch `feat/wallet-widget`, stacked on
`feat/sign-in-adapters`. It is the screen on top of SDK-G: sign-in, link, unlink and sign-out already exist as routes
and a client store; this task gives them their one home in the header and removes the interim page.

## 1. What the owner decided (surveys 4-11 in `game-sdk-roadmap.md`)

- **Placement:** top-right of the header on every page, replacing the Connect link; avatar and short address when
  connected; the connect modal can be opened from any screen.
- **Avatar:** generated from the address, deterministic, no profile or upload.
- **Menu when connected:** address with copy, balance with refresh, switch wallet / disconnect. Passkeys are added from
  the menu. The widget shows the wallet connected in the browser; a connected wallet that is not on the account shows
  "not linked" and "Link this wallet".
- **Balance:** BTC in sats and BTC, from the **chain indexer through our server**, with loading, stale and error states
  shown honestly; refreshed every 60 s **only while the menu is open**, plus a manual refresh.
- **Reconnect:** automatically to the last wallet; disconnect forgets it.
- **Network mismatch:** a warning badge with the expected network; the player may continue.
- **Providers:** the current 13 candidates, detected wallets first.
- **Sign-in only through the widget.** `/connect` is already gone; the interim `/sign-in` page goes with this task.
- **Games:** `wallet.connect()` asks the platform to open the same modal; the game never handles the wallet.

## 2. What the code forced (decisions on defaults, review at merge)

1. **There is no balance source.** The neutral port `ChainReader.balances` exists (`packages/chain/src/ports.ts`) but
   nothing implements it, and the indexer is an open decision gate (`maximum_indexer_lag_blocks`, SUBFROST plus
   fallbacks). The repository forbids inventing provider values, so **the balance route is built against the port and
   answers "unavailable" until a reader is configured**; the widget says so ("Balance unavailable: no data source is
   configured") and never shows a number it did not get. Tests use a fake reader. **Owner decision needed:** which
   indexer and which network endpoint(s) the signet beta reads from.
2. **The shell is rendered by about eight pages** and the wallet library is mounted per page today. The widget needs
   one mount for the whole app: a client **root** in the app layout holds the connection library, one wallet-session
   store and the modal; the shell renders a client **header slot** that reads that root. `@repo/ui` gets a generic slot
   (no dependency on a feature); the accounts feature supplies the widget; the app layout composes them explicitly.
3. **The wallet library now loads on every page.** Accepted by the owner's "every page"; the first-load size change is
   measured and recorded in the task record.
4. **Games reuse the root.** `WalletGamePlayer` stops mounting its own provider; it reads the connection from the root
   and asks the root to open the modal. A game that does not declare the wallet capability still sees nothing.
5. **`wallet.connect()` is an additive protocol method** (`wallet` capability, rate limited). It answers
   `{ requested: true }` (or `already-connected`); the outcome reaches the game as the existing `wallet.changed` event.
   A player who closes the modal is not told to the game as an error: nothing changes.
6. **The interim page is removed outright** (no redirect: the app is not public): the `/sign-in` page, its navigation
   entry, `SignInSurface` and the panel on `/account`. `/account` keeps passkeys. The `public-page` capability of the
   accounts feature goes with the page.
7. **Network mismatch** compares the connected wallet's network with the platform network from `configs/wallet.ts`.
   A game page also compares with the game's own network where the game declares one.

## 3. Design

- `packages/ui`: `Avatar` (deterministic from a string: a small pixel grid and two tokens colours derived by hash, no
  external image), `ShellSlotsProvider` + `HeaderSlot`.
- `features/accounts`: `WalletRoot` (provider + store + modal state + context), `WalletWidget` (button, menu),
  `useWalletRoot()` (open modal, connection, session), balance client store with explicit states
  (`idle | loading | ready | stale | unavailable | failed`), `GET /api/v1/wallet/balance` (public, address and network
  validated by the address codec, rate limited, no secrets in logs).
- Menu contents by view: `disconnected` (Connect wallet), `connected-signed-out` (Sign in), `not-linked` (Link this
  wallet), `linked`; always: address + copy, balance, network badge on mismatch, linked wallets with Remove (the
  existing recent-authentication rule), passkeys link to `/account`, Sign out, Disconnect.
- Accessibility: the trigger is a button with `aria-expanded`/`aria-controls`; Escape closes and returns focus;
  tab order stays inside the open menu only while it is open; reduced motion honoured.

## 4. Phases (one commit each)

1. Avatar and the shell slot (`@repo/ui`).
2. Balance: route, port wiring, client store with states (fake reader in tests).
3. The root, the widget and the menu in the accounts feature; composed in the app layout.
4. Games: shared root, `wallet.connect()` in the protocol, host, client and the explorer game; network mismatch.
5. Remove the interim page, nav entry, panel and capability; retarget e2e (sign-in through the widget); baselines.
6. Docs, README, interface doc, task record, findings, mutation proof, gates, bundle-size note.

## 5. Tests

Unit: avatar determinism and distinctness, slot, balance store states and the 60 s cadence (fake timers: runs only
while open, stops on close, manual refresh), the route (invalid address, wrong network, no reader, reader failure,
reader success, rate limit). Component: every widget view and menu state, copy, Escape and focus. e2e in a real
browser with the fake wallet: connect from the header on a public page, sign in, reload (auto-reconnect), link, remove,
disconnect, sign out, the modal opened from a game via `wallet.connect()`, mismatch badge. Mutation proof for the
cadence, the unavailable-not-zero rule, the mismatch check and the connect capability gate.

## 6. Not in this task

An indexer adapter (decision above), token balances, pending amounts, profile names and uploaded avatars, the email
adapter, passkey sign-in.
