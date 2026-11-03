# `@ador/feature-accounts`

Detachable authenticated account, studio, and staff route contributions.

## Public API

`createAccountsFeature(walletConfig, balanceSource)` is the registration export; `./widget` exports `WalletRoot`,
which the app layout mounts once. One place per job: signing in is the `/sign-in` page only, and managing how you sign in (link, remove and re-confirm
wallets, passkeys, email) is the account page only. The wallet widget (header, every page) connects a wallet, shows it and its
balance, leads to those two pages, and signs out. It does not read the session itself: the layout reads it on the server
(`readSessionState` in the app) and passes `session` (`signed-in`, `signed-out` or `unknown`) down. The public `/sign-in` page (ADR-021) offers every method the server's method
registry says can start a session, each in its own panel (`src/sign-in/`: `registry.ts` lists how each kind is shown, so a new method
is one view there plus its adapter in `runtime.ts`); a protected page sends a signed-out visitor to it with `?returnTo=` (checked by
`safeReturnPath` in `@ador/shared/auth/sign-in-path`: a plain path on this site, never the sign-in page, the API or another site),
and it goes on to that page once the server says the visitor is signed in. Passkeys sign in on the same page (`src/sign-in/passkey-sign-in*.ts(x)`; `POST /api/v1/passkeys/sign-in/options` and
`/verify`, both public, each with its own rate limit). Email signs in on the same page (`src/sign-in/email-sign-in*.ts(x)`; `POST /api/v1/email/sign-in/request` and `/verify`, both public, each
with its own rate limit): the person gives an address, is told a code is on its way _if that address can receive mail_ (the page never
says whether the address has an account), enters the code, and the server sets the session. It is offered only where mail is set up
(`MAIL_TRANSPORT`; `createAuthMethods({ email })` in `src/methods.ts` is how the composition root says so); without mail the request
route answers "not available" and the page does not show the panel. The account page shows an Email panel (`src/ui/email-panel.tsx`) where mail is set up: the account's addresses, add one by entering the code sent to it, remove one while another way in remains. It says a change signed the other sessions out and that the list is refreshed only after the server said so; a session too old to change sign-in methods is told to sign in again. The administrators' role screen (`src/roles/`, page `/admin/roles`, routes `GET /api/v1/admin/roles` and `POST` `/find`, `/grant`, `/suspend`, all for the capability `platform:manage-roles`, with rate limits) lists who holds platform roles and whether each one works (a role that needs a sign-in method the account lacks is recorded but does not act, and is shown as "active, not working yet"), finds a person by an exact email address, wallet address or account id, and gives, reinstates or suspends a role. Changes need a recent sign-in: when the session is too old the screen says so and offers "Sign again to confirm" (the wallet's step-up, `src/roles/confirm-it-is-you.tsx`; the sign-in page cannot do this, because it takes someone already signed in straight on), then makes the same change again. Changes act as the session's own account, are recorded by `@ador/authorization`, and refuse to suspend the last working administrator. People are named by their sign-in methods (`label`) and found by them (`lookup`), supplied by the method registry. A person who signed in by email links a wallet with the header widget's existing "Link this wallet". `createAccountsFeature` takes `EmailSignInRules | null` (the mail
settings and the code policy) from the composition root. The public `/setup` page and `POST /api/v1/auth/setup-link/redeem`
open the single-use link that makes the first administrator (ADR-021; `src/setup/`): the token follows the link's `#`, so the server
never sees it in an address; the page saves it for the visit, clears it from the address bar, and opens the link for whoever is signed
in (asking them to sign in if nobody is). It says "administrator" only after the server granted it, and a person missing a wallet is told
so and can retry with the same link. `createAccountsFeature` takes the policy's `SetupRules` (lifetime, policy version, required
methods) from the composition root. The operator makes the link with `pnpm platform:setup-link` (`tooling/platform-admin`). The route family also has
`GET /api/v1/wallet/balance`. `balanceSource` is where the widget's balance comes from: the beta wires the rewards chain's
own node (`configs/balance.ts`), and the answer keeps what is **spendable** (confirmed) apart from what is **pending** (waiting
for its first confirmation). With no chain configured it passes `null` and the widget says "Balance unavailable: no data
source is configured" (it never shows a number it did not get). Adding or removing it from `configs/features.ts`
adds or removes the complete page and passkey API route family. The lazy entrypoint is validated
against its manifest. Its manifest also contributes the public account entry, authenticated studio,
and capability-gated admin navigation items.

## Invariants

- The balance a tab reads is kept in the browser's `localStorage` for one `balanceRefreshMs` (`@ador/cache/expiring-store`): a new page or tab
  shows it at once, tabs take up a reading another tab shared instead of each asking, and a player's own refresh always asks the platform.
  A wallet that is disconnected or replaced leaves nothing behind. A stored value is checked against the balance schema and its age before use.
- After a successful sign-out the widget calls `onSignedOut` (the app refreshes the server-rendered page, which sends a private
  page's visitor to sign in); a failed sign-out does not and says why. `unknown` (the server could not read the session) is shown as
  neither signed in nor out. While a remembered wallet is reconnecting the button says so, for at most
  `reconnectWaitMs`.
- The wallet chooser closes when the choice is made (a wallet connected that was not, or a different one), never merely
  because a wallet is connected, so "Switch wallet" works.

- The balance is in the header beside the address, so it is asked for while a wallet is connected and the tab is showing (every
  `balanceRefreshMs`, a policy value), is read for the wallet connected now, and is forgotten when the wallet changes; an
  answer that arrives for a replaced wallet is dropped. A failed refresh keeps the older number marked as older. The coin is
  written BTC on mainnet and tBTC on a test network.

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

## Outcomes: one catalogue, never matched by text

Everything that can go wrong when a person signs in, links a way in or administers roles is one entry of `@ador/shared/account-outcomes`
(`accountOutcomes`): a reason name, the status class the server answers with (none for what only the browser knows), and the sentence.

- **Server:** `application/outcomes.ts` (`outcomeFailure`) builds every failure from the catalogue; the reason travels in the error
  envelope (`error.reason`, `httpErrorReasonSchema`).
- **Page:** `client/outcome.ts` (`failedFrom`, `outcomeOf`) turns a failed request into the catalogue's outcome by the reason, falling back to the
  status class only for what the server could not name (no connection, a rate limit, a gone session). It never reads the message, so rewording
  a sentence cannot change what a page does. Every flow returns `{ kind: "failed", outcome, message }`; no flow has a copy table of its own.
- **Adding an outcome:** add one entry. A test fails if two outcomes say the same sentence, if one has no words, or if the browser-only set
  changes. A sentence written outside the catalogue is what `repository:check` is there to catch.

## Ownership

Platform front end.
