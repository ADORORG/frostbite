# Runbook: authentication failures

Status: **early draft (W8-07).** Written from the code as it is today. Nothing below has been exercised
against a real deployment, and every command is read-only unless it says otherwise. There is no structured
error logging yet (task: structured logging at the HTTP boundary), so diagnosis relies on the database, the
response's correlation id, and the platform's logs.

## What exists today (so you know what can fail)

- **Sessions.** Server-side, hash-only: the database stores a SHA-256 of the session token, never the token
  (`ador.auth_sessions`). The browser holds the token in an HTTP-only, secure, same-site cookie. A session ends
  when idle time (`AUTH_SESSION_IDLE_TIMEOUT_MS`, default 24 h, sliding) or absolute time
  (`AUTH_SESSION_ABSOLUTE_TIMEOUT_MS`, default 7 days) passes, or it is revoked (`revoked_at`).
- **Authorization.** Roles and permissions come from the authorization policy and platform role assignments
  (`platform_role_assignments`); a session without the role gets `forbidden`, not a sign-in prompt.
- **Passkey linking** (`/account`): needs a recent sign-in (`PASSKEY_RECENT_AUTH_WINDOW_MS`, default 10 min);
  the ceremony lasts at most `PASSKEY_CHALLENGE_TIMEOUT_MS` (default 5 min). Linking or unlinking replaces the
  session.
- **Wallet challenge and verification** (BIP-322 simple signature) exists as a service
  (`@ador/auth`): a challenge lives 60 seconds by default, allows a bounded number of verification attempts,
  and is single-use. Its results are `challenge-expired`, `challenge-invalid`, `challenge-replayed`,
  `identity-conflict`, `signature-invalid`.
- **Not wired yet.** At the time of writing no public HTTP route issues wallet challenges or creates a
  session from one; the only routes that replace a session are the passkey operations, and the wallet routes
  that exist (`/api/v1/...qualification`) are diagnostic. Local and test sign-in uses seeded sessions
  (`pnpm stack`, `/dev/sign-in`), which does not exist in the application itself. Treat "user cannot sign in
  with a wallet" as an expected gap until that route ships, then update this runbook.

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

## Symptom: wallet signature rejected (service-level codes, once wired)

| Code                 | Meaning                                                             | Action                                                                                   |
| -------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `challenge-expired`  | 60 seconds passed (or the clock is wrong)                           | Retry; if constant, check server clock drift                                             |
| `challenge-invalid`  | Unknown challenge, wrong origin/domain/network, or attempts used up | Retry from a fresh challenge; confirm the wallet network matches (`mainnet` or `signet`) |
| `challenge-replayed` | The challenge was already used                                      | Expected after a double submit; retry fresh                                              |
| `signature-invalid`  | The wallet's signature did not verify                               | Wallet-specific; see the wallet conformance records before blaming the server            |
| `identity-conflict`  | The address belongs to a different account                          | Do not merge accounts by hand; escalate                                                  |

Check a challenge (read-only; the message and signature are never stored here):

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

- A public wallet sign-in route and its failure copy (then rewrite the wallet section).
- Shipping the logs somewhere searchable. An internal error (`http.internal_error`) and an unreachable session service
  (`http.auth_unavailable`) already write one JSON line each with the correlation id to the web process's error output; the
  other failures above are answered with a code and are not logged.
- An alert on a spike of `challenge-invalid` or `signature-invalid`. Rate limits now exist for the wallet
  challenge and passkey operations (10 a minute per address or person to start one, 20 to verify; see
  `configs/rate-limits.ts`); a caller over a limit is answered 429 with `Retry-After`.
- An operator view of a user's sessions that does not need SQL.
