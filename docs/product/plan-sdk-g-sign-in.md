# Plan: sign-in identity adapters and wallet sign-in (SDK-G, task #58)

Status: **approved by the owner on 2026-10-13 with the defaults** (no test-only route in the app; 24-hour hold on a removed wallet; sign-out ends only the current session; the W2-10B evidence was not supplied, so that ledger row stays blocked). Building on branch `feat/sign-in-adapters`. Written 2026-10-13 from the owner's decisions in
`game-sdk-roadmap.md` (tenth and eleventh surveys) and from reading the current code. It comes before the wallet
widget (SDK-F, #55), which is the screen on top of it.

## 1. What the owner decided

- Sign-in goes **through the wallet widget**: connect a wallet, sign a message, get a session. Sign-in is a set of
  **adapters**: wallet now, **email later** (non-web3 players). A player can **link a wallet or an email** to one
  account, and **several wallets** to one account.
- **Passkeys stay** as a secondary method, added from the widget menu.
- A wallet already on another account is **refused without saying whose** it is. Removing a method **cannot remove the
  last one**, **needs a recent signature or passkey step-up**, and **signs out the other sessions**.
- The widget shows the **connected** wallet; a connected wallet that is not linked shows **"not linked / Link this
  wallet"**. The account stays signed in.
- The owner reports the wallets are **tested working**. The ledger row W2-10B (physical evidence) is still `blocked`.

## 2. What exists today (read from the code, 2026-10-13)

| Piece                                                                  | State                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createWalletAuthService` (`packages/auth/src/application/service.ts`) | Issues a canonical challenge for the actions `sign-in`, `link-wallet`, `step-up`; verifies a BIP-322 signature; consumes the challenge once, in one transaction, with an attempt limit.                                                                                                                                                      |
| `drizzle-wallet-auth-repository.ts`                                    | `sign-in` with an unknown wallet **creates a user** (email `wallet-<id>@wallet.invalid`) and the wallet identity; `link-wallet` adds an identity to the signed-in user; a wallet owned by another user is `identity-conflict` (no detail). `link-wallet` and `step-up` **revoke all the user's sessions and create a fresh one** (rotation). |
| `wallet_identities` table                                              | Many per user (`user_id` index), unique per network and script.                                                                                                                                                                                                                                                                              |
| Sessions                                                               | `auth_sessions` with `authenticated_at`, so "recent" can be checked as passkeys do.                                                                                                                                                                                                                                                          |
| Passkeys                                                               | Link and unlink with a recent-authentication window and a "cannot remove the last method" rule (`packages/auth/src/passkeys`).                                                                                                                                                                                                               |
| **HTTP routes, pages, widget for wallet sign-in, link, unlink, list**  | **None.** The service has no callers outside tests.                                                                                                                                                                                                                                                                                          |
| Wallet unlink                                                          | **Does not exist** (only passkeys can be unlinked).                                                                                                                                                                                                                                                                                          |
| Qualification routes                                                   | `/connect` and the qualification operations: a diagnostic that explicitly does not sign in. To be removed (decided).                                                                                                                                                                                                                         |
| Dev sign-in picker and e2e sign-in                                     | Live **outside the web app** (`tests/e2e`: a stack proxy and sessions minted straight in the database). The app has no test sign-in route today.                                                                                                                                                                                             |

## 3. Findings that change the plan

1. **The core already exists.** SDK-G is mostly routes, the unlink side, an adapter port around what is there, the
   one rule that spans methods, and the UI. It is smaller than "build wallet sign-in".
2. **A test-only sign-in route is not needed and is safer not built.** The owner chose "a test-only route". Today's
   picker and e2e fixtures never go through the app, so a deployed build cannot contain them. Adding a route to the app
   (even guarded) adds a way to mint sessions to production code. **Recommendation: keep the harness-side minting** and
   use the real wallet path in e2e through a deterministic test wallet (section 6). This deviates from the survey
   answer; the owner can overrule it.
3. **Email placeholder.** A wallet-created user has `wallet-<id>@wallet.invalid`. When email is added as an adapter,
   linking an email replaces the placeholder; the column is unique and non-null today, so the email adapter must
   treat `*.wallet.invalid` as "no email".
4. **The wallet library needs `eval`** (task #56) and the policy is report-only. Signing in from the widget depends
   on that library, so enforcing the policy is a risk to this task. Not changed here.
5. **Evidence.** The wallets are reported working but W2-10B has no evidence record. Without it the ledger cannot be
   closed. The plan asks the owner for the wallet names, versions and results (section 8).

## 4. Design

### 4.1 An identity-method port (the adapter pattern)

A small port in `@ador/auth`, so the account does not care which method proved the person:

```
IdentityMethod  { id: "wallet" | "passkey" | "email"; list(userId); link(...); unlink(...); canSignIn: boolean }
```

- **wallet** adapter: wraps the existing wallet service and repository (sign-in, link, step-up) and gains `list` and
  `unlink`.
- **passkey** adapter: wraps the existing passkey service (list, link, unlink); `canSignIn` is false until a passkey
  sign-in is wanted (today it is link-only, as built).
- **email** adapter: **designed for, not built.** The port, the table shape and the placeholder rule leave room.
- One **method-count rule** lives in one place: an account must keep at least one method that can sign in. Today the
  rule is inside the passkey service; it moves to the port so wallet and passkey unlinking use the same function.
  (The rule counts methods across all adapters, so it cannot live inside one of them.)

### 4.2 Server (new, in `@ador/auth` and the accounts feature)

- Routes (authenticated or not as noted, all POST/GET JSON, same-origin, rate limited like the passkey routes):
  - `POST /api/v1/auth/wallet/challenge` (public): `{ address, network, walletAdapter, action: "sign-in" }`.
  - `POST /api/v1/auth/wallet/verify` (public): `{ challengeId, signature }` → sets the session cookie, rotating it.
  - `POST /api/v1/auth/wallet/link/challenge` and `.../link/verify` (authenticated).
  - `GET /api/v1/auth/methods` (authenticated): wallets (address, network, adapter, linked date) and passkeys.
  - `POST /api/v1/auth/wallet/unlink` (authenticated, **recent** session): refuses the last method, rotates sessions.
  - `POST /api/v1/auth/sign-out` (authenticated): revokes the session.
- A **removed wallet is held** for a short time before it can be linked elsewhere (the owner did not choose
  immediate reuse): a `released_at` on a small `released_wallets` record, default 24 hours, a typed policy value.
- "Recent" uses the same `recentAuthenticationWindowMs` as passkeys; a stale session is told to **step up** with a
  `step-up` signature (the action exists).
- Failures are generic, as today: `identity-conflict` never says whose wallet it is, in the response, the log or the
  audit event. Challenge issue and verify are rate limited per address and per network location (new policy keys).
- Audit: link, unlink and sign-in write the existing security events (the enum gains `wallet-linked`,
  `wallet-unlinked`, `wallet-signed-in`).
- **Database:** one migration: `released_wallets` and the three event values. No change to `wallet_identities`.
- **Environment:** none new if the policy values come from the existing auth environment keys; any new key is added to
  `.env.example` and the typed definition together.

### 4.3 Client (the widget's logic, not its look)

- A hook in a new client module of `@ador/wallet`/the accounts feature (not in the games feature):
  `useWalletSession()` returns `{ wallet, account, methods, signIn(), link(), unlink(id), signOut(), state }`, where
  `state` has explicit values (`disconnected`, `connected-signed-out`, `signing`, `signed-in`, `not-linked`,
  `failed(reason)`), so the widget never shows "signed in" before the server said so.
- The wallet **connection** stays the existing library boundary (`@ador/wallet/client`); nothing in a feature calls an
  extension directly. Signing goes through the normalized `signMessage` it already exposes.
- The widget (SDK-F) consumes this hook. SDK-G ships the hook and a plain "connect, sign in, methods" panel that
  replaces the qualification page; SDK-F replaces that panel with the header widget.

### 4.4 What is removed

`/connect`, the qualification page and its operations, their navigation entry and tests, and the qualification table
(`wallet_qualification`), as decided (**rebuild when needed**). The evidence **records** (docs) stay. The plan lists
every file in the task record when it is deleted.

## 5. Phases (each its own commit on one branch, stacked on `feat/game-milestone-progress`)

1. **Method port and the shared rule.** Move the "keep one method" rule out of the passkey service; wallet and passkey
   list through the port; no behaviour change for passkeys (existing tests must still pass unchanged).
2. **Wallet unlink and the hold.** Service, repository, migration, tests (including the last-method case, a stale
   session, the hold, session rotation, concurrent unlink and link of the same wallet).
3. **Routes.** Operations for challenge, verify, link, unlink, methods, sign-out, with the cookie effect, rate limits,
   contracts in OpenAPI, and negative tests for every refusal.
4. **Client hook and the replacement panel**, with the explicit state machine and a fake connection for tests.
5. **Remove `/connect` and the qualification feature**; navigation, home page and snapshots updated.
6. **e2e.** A deterministic test wallet (a local BIP-322 signer built on the project's verifier and test keys) so the
   real challenge, signature and session path runs in the browser without an extension. Keep the harness-side session
   minting for everything that is not about sign-in.
7. **Docs, task record, findings, ledger** (W2-10B stays `blocked` until the evidence record exists).

## 6. Test plan (the repository rules apply)

- Unit and integration tests at each boundary, positive and negative: wrong signature, expired, replayed, attempt limit,
  conflict, stale session, last method, unknown method id, concurrent link of one wallet to two accounts (advisory
  lock exists), double unlink, unlink then sign in again.
- Real PostgreSQL integration for the repository and the hold.
- **Mutation proof** for the rule, the recency check, the hold, the generic conflict, session rotation and the cookie.
- e2e in a real browser: sign in with the test wallet; link a second wallet; try to link one that belongs to another
  account (generic refusal); unlink down to one method and be refused; stale session asks for step-up.
- Accessibility, keyboard and reduced-motion coverage for the replacement panel; the widget's own visual coverage
  belongs to SDK-F.
- Coverage above 90% including branches; 100% branches for the method rule, recency and conflict handling (they are
  authorization modules).

## 7. Risks

- Enforcing the CSP (task #56) would break the wallet library: signing from the widget stops working.
- Removing `/connect` removes the only physical-evidence tool. If the owner wants to re-test wallets, the tool must be
  rebuilt (accepted by the owner).
- Wallet users have a placeholder email; the future email adapter needs the rule in section 3.
- Linking several wallets means the player's identity is the account, not one address: the games' opaque player id
  already follows the account, so nothing there changes.

## 8. What I still need from the owner (small)

1. **The wallet evidence** for W2-10B: which wallets, versions, networks and what was tested (sign-in, link,
   network switch), so the record can be written and the row closed.
2. **The hold on a removed wallet:** 24 hours by default; say a different time if wanted.
3. **The test-only route:** accept the recommendation not to add one to the app (section 3.2), or overrule it.
4. **Sign-out:** the widget will offer it; confirm sign-out revokes only this session (default), not all.

## 9. Not in this task

The header widget (SDK-F), balance, avatar, `wallet.connect()` for games, the email adapter, passkey **sign-in**
(passkeys remain link-only), account merging, and any change to how milestones or saves attach to the account.
