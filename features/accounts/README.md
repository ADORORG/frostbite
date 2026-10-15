# `@ador/feature-accounts`

Detachable authenticated account, studio, and staff route contributions.

## Public API

`createAccountsFeature(walletConfig, balanceSource)` is the registration export; `./widget` exports `WalletRoot`,
which the app layout mounts once. The wallet widget (header, every page) is how a player connects a wallet, signs in
with it, links and removes wallets and signs out; there is no sign-in page. The route family also has
`POST /api/v1/wallet/balance`. `balanceSource` is where the widget's balance comes from: the platform has **not
chosen an indexer**, so the beta passes `null` and the widget says "Balance unavailable: no data source is
configured" (it never shows a number it did not get). An adapter implementing `BalanceSource` is the only thing
missing. Adding or removing it from `configs/features.ts`
adds or removes the complete page and passkey API route family. The lazy entrypoint is validated
against its manifest. Its manifest also contributes the public account entry, authenticated studio,
and capability-gated admin navigation items.

## Invariants

- After a successful sign-in or sign-out the widget calls `onSessionChange` (the app refreshes the server-rendered
  page); a failed sign-in does not. While a remembered wallet is reconnecting the button says so, for at most
  `reconnectWaitMs`.
- The wallet chooser closes when the choice is made (a wallet connected that was not, or a different one), never merely
  because a wallet is connected, so "Switch wallet" works.

- The balance is asked for only while the widget's menu is open (every `balanceRefreshMs`, a policy value), is
  read for the wallet connected now, and is forgotten when the wallet changes; an answer that arrives for a
  replaced wallet is dropped. A failed refresh keeps the older number marked as older.

- Access requirements are manifest data and are enforced before `render` is called.
- Account and studio require an active platform session.
- Admin additionally requires the configured `platform:operate` capability.
- UI copy never equates authentication with creator approval, publication, or on-chain authority.
- Passkey linking requires the exact recent session, and successful link/unlink responses rotate
  the host-only platform cookie without placing its bearer token in JSON.

## Dependencies and configuration

The feature owns its replaceable SimpleWebAuthn browser adapter and composes the auth repository at
its server-only runtime boundary. Domain logic remains in `@ador/auth`; validated application URL,
name, session, and ceremony durations are mapped into its provider-neutral policy. Cookie handling
remains in the Next adapter so the feature can move to another HTTP host without changing domain
logic.

## Verification

Run `pnpm --filter @ador/feature-accounts typecheck`, `test:unit`, `test:integration`, and
`test:coverage`. Browser route states are covered by the shared Playwright workspace.
