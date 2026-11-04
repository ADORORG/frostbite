# Runbook: authentication failures

Status: **current as of the sign-in work of ADR-021 (steps 1 to 7), written from the code.** The commands are read-only unless one
says otherwise. Nothing here has been exercised against a real deployment: the mail server, a physical passkey device and a real
wallet extension have not been tried (see the gaps at the end). An internal error and an unreachable session service each write one
JSON line with the correlation id to the web process's error output (`http.internal_error`, `http.auth_unavailable`); other failures
are answered with a code and are not logged, so diagnosis relies on the database, the response's correlation id and the platform's logs.

## What exists today (so you know what can fail)

- **Ways in** (the page is `/sign-in`; a protected page sends a signed-out visitor there with `?returnTo=`): a Bitcoin **wallet**
  (a signed challenge), a **passkey** (a discoverable credential), and an **email code** (only where mail is set up). One account can
  hold several, and no account is ever merged into another. The set a deployment offers is composed once in
  `configs/auth-methods.ts` from the method registry (ADR-021).
- **Sessions.** Server-side, hash-only: the database stores a SHA-256 of the session token, never the token
  (`ador.auth_sessions`). The browser holds the token in an HTTP-only, secure, same-site cookie. A session ends
  when idle time (`AUTH_SESSION_IDLE_TIMEOUT_MS`, default 24 h, sliding) or absolute time
  (`AUTH_SESSION_ABSOLUTE_TIMEOUT_MS`, default 7 days) passes, or it is revoked (`revoked_at`).
- **Authorization.** Roles and permissions come from the authorization policy and platform role assignments
  (`platform_role_assignments`); a session without the role gets `forbidden`, not a sign-in prompt. `staff` and `admin` work only
  while the account holds a wallet.
- **Changes to sign-in methods and roles** need a recent sign-in (`PASSKEY_RECENT_AUTH_WINDOW_MS`, default 10 min), replace the
  account's sessions, and are audited: wallets, passkeys and email addresses in `ador.auth_security_events`, role changes in
  `ador.platform_role_events`.
- **Wallet challenge and verification** (BIP-322 simple signature): a challenge lives 60 seconds by default, allows a bounded number of
  verification attempts, and is single-use. A removed wallet is held for a while: only the account that had it can take it back.
- **Passkey linking** (`/account`): the ceremony lasts at most `PASSKEY_CHALLENGE_TIMEOUT_MS` (default 5 min). Passkey sign-in spends
  its challenge on the first attempt, right or wrong.
- **First administrator.** `pnpm platform:setup-link` prints a single-use link (`/setup#<token>`, valid for an hour) while no working
  administrator exists; after that, administrators use the role screen (`/admin/roles`). On a deployment, run it in the web container (`docs/operations/deployment.md`, "First administrator").
- **Local and test stacks.** `pnpm stack` runs the real sign-in (wallet, passkey, email with the codes captured by `pnpm mailbox`) and
  also a front door at `/dev/sign-in` that signs in as a seeded person. That page belongs to the stack's own front door, never to the
  application, so it cannot exist in a deployed build.

## Error shapes

Every API error is `{ "error": { "code", "correlationId", "message" } }`. Codes: `unauthorized` (no or ended
session), `forbidden` (signed in without permission, or recent sign-in required), `conflict`,
`invalid_request`, `not_found`, `idempotency_key_required`, `method_not_allowed`, `rate_limited` (HTTP 429, with a `Retry-After` header), `internal_error`.
Ask the reporter for the `correlationId` (visible in the response) or the time and account.

## Symptom: "I was signed out" / `unauthorized` on every request

1. Is it expected? Idle 24 h without a request, or 7 days since sign-in, ends a session by design.
2. Check the session (replace the user id; read-only):
   ```sql
   select id, authenticated_at, idle_expires_at, absolute_expires_at, revoked_at
   from ador.auth_sessions where user_id = '<user-id>' order by authenticated_at desc limit 5;
   ```
   - `revoked_at` set: revoked on purpose (passkey change, security action). Ask the user to sign in again.
   - past `idle_expires_at` or `absolute_expires_at`: expired. Sign in again.
   - no rows: the user never had a session on this environment (wrong environment, or database restored from
     before they signed in).
3. All users signed out at once: check that `DATABASE_URL` points where it should, that a restore did not
   rewind `auth_sessions`, and that the cookie's `secure` flag is not blocked by a plain-http hostname. A
   changed `PUBLIC_BASE_URL` or hostname does not invalidate sessions in the database, but the browser sends
   the cookie only to the host that set it.

## Symptom: `forbidden` for someone who should have access

1. Confirm the role: platform roles live in `ador.platform_role_assignments` (`user_id`, `role`, `status`).
   A role with `status` other than `active` grants nothing (a suspension is a status change, not a delete).
2. Reviewers and staff need the role named in `configs/authorization.ts`; check the policy version in the
   deployed build matches the one reviewed.
3. For creators: `forbidden` on collection actions means the creator application is not `approved`
   (`ador.creator_applications.state`). Approval is rechecked inside each change, so a suspension takes effect
   at once, even in the middle of a session.
4. Passkey changes: `forbidden` with "Recent authentication is required." means sign in again, then retry
   within the window.

## Symptom: passkey link or unlink fails with `conflict`

"The passkey change could not be completed." covers: the ceremony expired, the credential is already linked
to another account, or it would remove the account's last sign-in method (blocked on purpose). Ask the user to
restart the ceremony from `/account`. If it repeats, confirm `PASSKEY_*` timeouts are set and that the relying
party origin matches the site's origin exactly; a mismatch fails every ceremony. Do not unlink a user's final
method by hand.

## Symptom: wallet sign-in or linking fails

| Code                 | Meaning                                                             | Action                                                                          |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `challenge-expired`  | 60 seconds passed (or the clock is wrong)                           | Retry; if constant, check server clock drift                                    |
| `challenge-invalid`  | Unknown challenge, wrong origin/domain/network, or attempts used up | Retry from a fresh challenge; confirm the wallet network matches `BETA_NETWORK` |
| `challenge-replayed` | The challenge was already used                                      | Expected after a double submit; retry fresh                                     |
| `signature-invalid`  | The wallet's signature did not verify                               | Wallet-specific; see the wallet conformance records before blaming the server   |
| `identity-conflict`  | The address belongs to a different account                          | Do not merge accounts by hand; escalate                                         |

The person is told only "The wallet could not be verified. Request a fresh challenge." for all of these but `identity-conflict`, which reads
"This wallet cannot be used for that." (it also covers a wallet that was just removed from another account and is still held). The
codes above are for you; they are not shown. Check a challenge (read-only; the message and signature are never stored here):

```sql
select id, action, network, wallet_adapter, attempts, issued_at, expires_at, consumed_at
from ador.wallet_challenges order by issued_at desc limit 10;
```

Never log, paste or ticket a signature, a session token or a challenge message.

## Symptom: "the email code never arrives" / the Email panel is missing

1. **No Email panel on `/sign-in`.** Email sign-in is offered only where mail is set up: `MAIL_TRANSPORT` is blank, so the platform
   has no mail and says so by not showing it. Set the `MAIL_*` keys (see `.env.example`) and restart: the mail settings are read once, at boot (a wrong
   one stops the process with a message naming the key), and the page is rendered on request.
2. **"The code could not be sent."** The mail server refused or did not answer. The process's error output has no address or
   password (only a short code such as `EAUTH` for a wrong login or `ETIMEDOUT`); check `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`,
   `MAIL_SMTP_ENCRYPTION` (465 is `tls`, 587 is `starttls`), the login, and the provider's own dashboard. A failed send leaves no
   code and no cooldown, so the person can try again at once.
3. **Sent but not received.** The sender address (`MAIL_FROM_ADDRESS`) must be on a domain the provider has verified (SPF, DKIM); an
   unverified domain is filtered as spam or refused. Look in the provider's delivery log for the message.
4. **"A code was sent recently."** One minute between codes to an address and five an hour (`emailCodePolicy`). A newer code
   replaces the older one, so a person who asked twice must use the **latest** email. Read-only check:
   ```sql
   select issued_at, expires_at, attempts, consumed_at from ador.contact_codes
   where kind = 'email' and destination = '<lower-case address>' order by issued_at desc limit 5;
   ```
   `attempts` of 5 means the code is spent (five tries, right or wrong); `consumed_at` set means it was used or replaced.
5. **Local stack.** Nothing is sent: `pnpm mailbox` prints what the stack "sent" (newest first).
6. **Adding an address to an account.** "Recent authentication is required" means the session is older than `PASSKEY_RECENT_AUTH_WINDOW_MS`: the person signs in again, then retries. "This account already has as many email addresses as it can hold" means the account is at `emailAddressPolicy.maximumPerAccount` (`configs/email-addresses.ts`): the person removes one first; nothing is mailed for the refused address, and the check is also made when the code is entered (read-only check: `select count(*) from ador.contact_identities where user_id = '<user-id>' and kind = 'email';`). "This address cannot be added to this account" means another account holds it (the page does not say whose); the person signs in with that address instead, or removes it from the other account first. There is no merging. Every add or remove signs the account's other sessions out and writes `email-linked` / `email-unlinked` to `ador.auth_security_events` (read-only check: `select action, created_at, correlation_id from ador.auth_security_events where actor_user_id = '<user-id>' order by created_at desc limit 10;`).

## Symptom: "an administrator cannot change roles" / "a role I gave does not work"

1. **"Recent authentication is required."** Role changes need a sign-in within `PASSKEY_RECENT_AUTH_WINDOW_MS` (ten minutes). The administrator signs in again and retries.
2. **"Only an administrator whose role is working can change roles."** Their own `admin` role is suspended, or they no longer hold a wallet (administrators need one). The role screen lists each role as `active`, `active, not working yet` or `suspended`.
3. **A role was given and shows "not working yet".** `staff` and `admin` need a wallet linked to the account; an email-only account holds the role but it does not act. The person links a wallet from the header, and it starts working. Read-only check: `select r.role, r.status from ador.platform_role_assignments r where r.user_id = '<user-id>';` and `select count(*) from ador.wallet_identities where user_id = '<user-id>';`.
4. **"This is the last working administrator."** Make another administrator first (the role screen), then suspend. If nobody can use the screen at all, mint a setup link (`pnpm platform:setup-link`), which works only while no working administrator exists.
5. **Who changed what.** Every grant, reinstatement and suspension is in `ador.platform_role_events` with the actor, the target, the policy version and `via` (`role-screen` or `setup-link`).

## Containment (security events)

- Revoke one user's sessions (**write**; production approval required, record who and why):
  `update ador.auth_sessions set revoked_at = now() where user_id = '<user-id>' and revoked_at is null;`
- Revoke everyone (suspected token exposure): the same statement without the user filter. All users must sign
  in again. Announce it first.
- Suspend a creator or reviewer through the product (creator or role status), not by deleting rows: every
  action rechecks status inside its transaction.

## Verify the fix

Sign in as a test account in the same environment, open `/account`, make one authenticated request, and
confirm the session row shows a fresh `authenticated_at` and a future `idle_expires_at`.

## Gaps to close (feed the backlog)

- Nothing here has met a real deployment: a physical or platform passkey, a real wallet extension, and a real mail provider (the
  SMTP sender is proven against a local SMTP server; implicit TLS and the STARTTLS upgrade are not exercised) are all untried.
- Shipping the logs somewhere searchable. Only internal errors and an unreachable session service are logged; the other failures
  above are answered with a code and are not logged.
- An alert on a spike of `challenge-invalid`, `signature-invalid` or failed email codes. Rate limits exist for every sign-in step
  (`configs/rate-limits.ts`); a caller over a limit is answered 429 with `Retry-After`.
- A view of audit events and of a user's sessions that does not need SQL (the role screen shows who holds roles, not the history).
- Expired challenge and code rows are swept by the worker (`passkey_challenges`, `passkey_sign_in_challenges`, `wallet_challenges`, `contact_codes`, and delivered
  `outbox_events`; `expiredRowPolicy` in `configs/expired-rows.ts`): a challenge once it expires, a contact code once it has expired and
  is older than the send window (the send limits count recent codes, expired or not), a delivered event after a week. The worker logs
  `expired rows removed` with counts per table when a pass removed something and `row sweep failed` when one failed (the loop backs off
  a minute and tries again). To see what is waiting: `select count(*) from ador.wallet_challenges where expires_at < now();`.
- Sign-ins are not audited (only changes to ways in and to roles are).
