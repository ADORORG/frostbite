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
- A platform role can be tied to a kind of sign-in method by the policy (`requiredMethods`: staff and admin need a `wallet`). Such a
  role is recorded but does not work while the account lacks the method (`effectiveRoles`); `forPlatform` applies this, using the
  methods the composition root supplies (`HeldKinds`), so this package knows no method. A reviewer cannot be given requirements:
  reviewer decisions are checked inside their own transactions (`role-guard`), which do not read them.
- `createRoleAdministration` and `createDrizzleRoleAdministration` grant, reinstate and suspend platform roles. Only an
  administrator whose own role works may change a role; asking for what is already so changes nothing and writes nothing; every
  change writes `platform_role_events` in its transaction; role changes are serialized platform-wide; and the last working
  administrator can never be suspended, including by themselves or concurrently.
- `createSetupLinkService` and `createDrizzleSetupLinks` make and open the single-use link for the first administrator. The token is 256
  random bits and only its SHA-256 is stored. Minting takes the platform-wide role lock, is refused while a working administrator exists,
  and voids earlier unused links; opening is refused for an unknown, expired, replaced or spent link (one answer for all), or when
  setup is already over, and tells a person missing a required method to add it (the link stays unspent). The grant is an
  `admin` role event with `via: "setup-link"` and the redeemer as the actor; a retry by the same person changes nothing; two people
  opening one link together produce exactly one administrator (the link's row lock).
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

## Ownership

Platform engineering.
