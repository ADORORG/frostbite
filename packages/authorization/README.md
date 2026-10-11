# `@ador/authorization`

Detachable server-side account mutation and authorization policy boundaries.

## Public API

- `createAuthorizationService` evaluates organization and platform capabilities against a validated,
  versioned policy and repository port.
- `createAccountService` validates organization creation and derives permitted membership actors
  from the same policy.
- `@ador/authorization/role-guard` exports `holdsActivePlatformRole`, which a domain transaction uses to
  check a platform role with a shared lock on the assignment row, so a role withdrawal waits for the
  decision it would have authorized.
- Drizzle adapters persist account records, recheck actor membership inside the mutation transaction,
  preserve the last-active-owner invariant, and append audit evidence.

## Invariants

- Organization roles never grant platform reviewer or staff authority.
- Suspended organizations, memberships, and platform assignments grant no capabilities.
- Organization creation and initial ownership are one transaction.
- Organization-row locking serializes membership changes. The final active owner cannot be demoted or
  suspended, including under concurrent requests.
- Every successful organization or membership mutation writes actor, target, correlation, policy,
  prior state, next state, and timestamp evidence in the same transaction.

## Configuration

The composition root supplies the complete `AuthorizationPolicy`, membership-management capability,
and clock. This package reads no environment variables or provider configuration directly.

## Verification

```bash
pnpm --filter @ador/authorization env:check
pnpm --filter @ador/authorization lint
pnpm --filter @ador/authorization typecheck
pnpm --filter @ador/authorization test:unit
pnpm --filter @ador/authorization test:integration
pnpm --filter @ador/authorization test:coverage
```
