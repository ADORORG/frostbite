# `@ador/auth`

Detachable, server-only Bitcoin wallet authentication, passkey linking, and session lifecycle logic.

## Public API

- `createWalletAuthService` issues canonical BIP-322 challenges and verifies them through injected
  repository and verifier ports.
- `createDrizzleWalletAuthRepository` persists challenges and atomically consumes them while
  creating or resolving the wallet identity, user, and session.
- `createSessionService` resolves, renews, and revokes opaque sessions through an injected port.
- `createDrizzleSessionRepository` stores only SHA-256 token hashes and enforces idle, absolute,
  and revocation predicates in PostgreSQL.
- `strictBip322Verifier` contains the `bip322-js` boundary.
- Sign-in methods are adapters (ADR-021). `MethodAdapter<Context>` is the one port a method implements (`kind`, `assurance`,
  `canSignIn`, `list`); `createMethodRegistry` composes them at the composition root and refuses a malformed or repeated kind
  or a set in which nothing can sign in. `walletMethod` and `passkeyMethod` are the two that exist. The rules (`removalOutcome`,
  `holdsMethod`, `meetsAssurance`) are pure, take the account's listed methods and know no kind by name. A new method is an
  adapter, one line in the composition root (`features/accounts/src/runtime.ts`) and its own routes: nothing here is edited.
- `removalOutcome` is the one rule for removing a sign-in method (wallet or passkey): an account keeps at least one
  method that can sign in. `createWalletMethodsService` lists an account's wallets and removes one (recent session,
  never the last way in, other sessions signed out, the removed wallet held before another account may take it).
- `walletAuthRoutes` and the wallet request/response schemas are the contracts for wallet sign-in, link, step-up,
  unlink, methods and sign-out; `verify` takes the action and account a route expects, so a link challenge cannot
  sign anyone in.
- `createPasskeyLinkingService` owns recent-auth registration, conflict-safe linking, final-method
  protection, session rotation, and provider-neutral contracts.
- `simpleWebAuthnRegistrationAdapter` contains the exact-pinned SimpleWebAuthn server boundary.
- `createPasskeySignInService` (with `createDrizzlePasskeySignInRepository` and `simpleWebAuthnAuthenticationAdapter`) signs a
  person in with a discoverable passkey: `begin` issues a challenge that belongs to nobody and offers no list of credentials;
  `finish` spends the challenge first (one attempt each, atomically), finds the account from the credential that signed, has the
  library verify the signature, origin, relying party, user verification and that the signature counter moved forward, then
  starts a session (other sessions stay). Every failure looks the same to the caller.
- `createContactCodeService` (`src/contacts/`, with `createDrizzleContactCodeRepository`) signs a person in with a one-time code
  sent to a contact. It is the same for every channel: a `ContactChannel` says how a destination is written (`normalize`), how a
  code is delivered (`deliver`), and its policy (digits, lifetime, tries, resend cooldown, sends per window); `createEmailChannel`
  is the email one (over the `MailSender` port of `@ador/mail`) and a text-message channel would be another. `request` normalizes
  the destination, then issues under a per-destination lock (cooldown and window limits are decided where two requests together
  cannot both slip under them; a newer code replaces the older ones), sends it, and forgets the code if the send failed. `verify`
  counts a try before it compares (so tries cannot be dodged), checks the salted hash in constant time, then spends the code and
  signs in by one transaction: of any number of attempts with a code, one signs in. The account is found or made only after the
  code is right, so nothing before that depends on whether the address has an account. `emailMethod` (`createContactMethod`) lists an
  account's addresses for the method registry (standard assurance, can sign in). Routes: `POST /api/v1/email/sign-in/request` and
  `/verify`, both public.
- `createContactLinkService` (with `createDrizzleContactLinkRepository`) adds an address to the signed-in account and removes one. Adding needs
  a recent sign-in and the code sent to the new address (`request` asks the code service for a *link* code that belongs to the account;
  `confirm` counts the try and checks the code without spending it; `completeLink` spends it with the change, in one transaction under
  the address's lock and from a session that is still recent). An address another account holds is refused after the code has proved the
  mailbox, the code is spent, and nothing moves and nothing says whose it is (ADR-021 point 5). Removing needs a recent sign-in and
  never takes the last way in (the registry's `removalOutcome`), under the account's lock. Both replace every session of the account
  and write `email-linked` / `email-unlinked` to `auth_security_events` with a hash of the address. Routes (all need a session):
  `GET /api/v1/email/addresses`, `POST /api/v1/email/link/request`, `/link/verify`, `/unlink`.

Callers compose these exports explicitly. Removing wallet authentication requires removing its
registration and route adapter; no feature discovery or global registration is used.

## Invariants

- Challenges bind the canonical address, script identity, network, origin, URI, domain, action,
  request ID, nonce, timestamps, signature scheme, and schema version.
  A diagnostic signature cannot be used by
  the authentication repository. Public deployment requires rate limits and expired-row cleanup.
- Only the canonical message hash is stored. The signature and full message are not persisted.
- A challenge is consumed once inside a row-locked transaction. An advisory transaction lock
  serializes first use of the same script identity across different challenges.
- Session bearer tokens contain 256 random bits and exist only in the successful response. Only
  their SHA-256 hashes reach storage.
- Session lookup requires both idle and absolute expiry to be in the future and renews idle expiry
  no later than the absolute limit. Revocation is idempotent.
- Wallet-first users receive a reserved `.invalid` internal email and it is never marked verified.
- Better Auth must not own wallet sessions unless a future adapter proves that stored hashes can
  never be accepted as bearer credentials in lookup, listing, or revocation flows.
- Passkey challenges bind one user, session, RP ID, origin, and expiry. Linking and unlinking lock
  the active recent session, rotate all sessions, and atomically append privacy-preserving audit
  evidence.
- Passkey sign-in challenges (`passkey_sign_in_challenges`) bind an RP ID, origin and expiry, and are stored as hashes. The
  credential's counter is updated only if it is still the value read (`counter = expected`), so two sign-ins that use the same
  counter, which is what a cloned authenticator does, cannot both succeed. A passkey is bound to the site's domain: the policy
  refuses to start unless the relying party is the host of the platform's own origin.
- The UI makes no recovery claim for passkeys.
- A code opens only the thing it was sent for: a sign-in code cannot link and a link code cannot sign in (the code row carries the
  account it was sent to, and a try is counted only against the matching one).
- Email codes: only a salted hash is stored; five tries, right or wrong, then the code is dead; a code works once; a code does not
  outlive its lifetime to the millisecond; a failed send leaves no code and no cooldown. A contact identity (`kind` + normalized
  value) belongs to one account for good: no merging (ADR-021 point 5). `auth_users.email` is a placeholder
  (`contact-<id>@contact.invalid`), never read for sign-in.

## Configuration

All durations and attempt limits are supplied through `WalletAuthPolicy`; no environment or
provider value is read inside this package. The route composition layer owns validated environment
mapping and allowed-origin policy.

## Verification

Docker is required for integration and coverage commands because they apply the real migrations to
an isolated PostgreSQL 18 container.

```bash
pnpm --filter @ador/auth typecheck
pnpm --filter @ador/auth lint
pnpm --filter @ador/auth test:unit
pnpm --filter @ador/auth test:integration
pnpm --filter @ador/auth test:coverage
```
