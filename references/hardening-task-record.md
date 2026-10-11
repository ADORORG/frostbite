# W8-06 (code part) Rate limits, security headers, health and readiness checks

Branch `feat/w8-06-hardening`, stacked on `feat/w8-03-game-hosting`. The dashboards and alerts of the same
ledger row depend on a deployment and are not done.

## What was built

- **Readiness.** `GET /api/ready` (web) and `GET /ready` (worker): the database and object storage each answer a
  small request within a time limit; 200 when both do, 503 otherwise; the body names each check and its outcome
  and nothing else (reasons go to the log). `/health` stays liveness only. `@ador/http/readiness`,
  `databaseReadinessProbe`, `storageReadinessProbe` (asks about a key nobody writes).
- **Security headers** (`apps/web/src/proxy.ts`): a Content Security Policy with a per-response nonce for scripts
  (`strict-dynamic`), storage origin only for images and uploads, no frames in or out, no plugins; plus nosniff,
  frame deny, referrer policy, a permissions policy, same-origin-allow-popups for wallet windows, and HSTS on an
  https platform. `SECURITY_CSP_MODE` (default report-only) sends the policy as report-only or enforced; reports go
  to `POST /api/csp-report` (bounded, reduced to three short fields, logged, rate limited). The root layout turns
  off schema compilation in the validation library, whose probe for script evaluation was 15 of 16 reports.
- **Rate limits.** A `rate_limited` platform error (HTTP 429 with `Retry-After`). A gate in the API route: by
  network address before any other work (and, for operations open to anyone, that operation's own limit), then by
  person per operation after sign-in. Policy in `configs/rate-limits.ts` (versioned record: address 600/min,
  anonymous 60, read 600, write 120, tighter for sign-in-adjacent, passkey, submit and import operations).
  Counted in PostgreSQL (`rate_limit_windows`, subject stored as a SHA-256 hash, old windows cleared as new ones
  begin); an in-process limiter for tests. `TRUSTED_PROXY_HOPS` says how many proxies to trust for the client
  address. A failing counter lets requests through and logs.
- Two new optional environment keys (`SECURITY_CSP_MODE`, `TRUSTED_PROXY_HOPS`) in the typed inventory and all
  templates; the local and test templates set `TRUSTED_PROXY_HOPS=0` (no proxy).
- Runbooks and the preview checklist updated.

## Findings

- Next sets `X-Forwarded-For` from the socket address when none is present and never appends, so a direct run
  looks like a proxied one: every test shared one address. The end-to-end server sets `TRUSTED_PROXY_HOPS=0`.
- Running the suite's wallet, passkey, upload, collection, bulk, import and acceptance journeys (120 tests) with
  the policy **enforced** passes; the one report left is the wallet library's probe of script evaluation on
  `/connect`. So the policy can be enforced; the default stays report-only until preview confirms.
- The real value for `TRUSTED_PROXY_HOPS` on the chosen host must be verified (checklist item).

## Evidence

- Unit tests across shared, http, config, object-storage, database, worker and web; integration tests for the
  PostgreSQL limiter, the API boundary (429 envelope, per-address counts, the proxy-recorded address) and readiness.
- E2E (`platform-hardening.spec.ts`): readiness is 200 with both checks ok, headers on every response, a new
  nonce per page, no policy violations on public and studio pages beyond the known probe, and a person over a
  limit is told 429 with `Retry-After` (20 attempts allowed, the 21st refused).
- Mutation proofs: 38 on the new code (limit boundary, windows, policy resolution, address selection, gate
  stages and fail-open, readiness timing and status, security headers and nonce, report bounds, the 429 answer,
  the database counter: increment, clearing, hashing, window), all killed; two mutants were equivalent (a floor
  of one second that the arithmetic already guarantees, which was removed) or not a real change.

## Not done

Dashboards and alerts (need a deployment); a log shipper and structured logs (task: structured error logging);
per-route CSP tuning if a future page needs a new external origin; the three-pass convergence loop.
