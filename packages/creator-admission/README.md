# Creator admission

Owns creator application drafts, immutable review snapshots, lifecycle transitions, and reviewer decisions.

## Public API

`createCreatorAdmissionService` contains validated application rules. `createDrizzleCreatorAdmissionRepository` is the PostgreSQL adapter. Consumers depend on the service and repository port, not database internals.

## Invariants

- An applicant has at most one application.
- Submission captures an immutable, versioned snapshot.
- Approval requires an authoritative verified email.
- Active configured reviewers may review, and cannot review themselves.
- Lifecycle changes lock the application and persist an audit event atomically.
- Approval grants creator admission only; it grants no project or deployment authority.
- The applicant's view carries the latest message a reviewer wrote for them (`feedback`), read from the audit
  events; private notes and evidence are never part of it.

## Commands

Run `pnpm env:check`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, and `pnpm test:coverage` from this package.

The platform team owns policy configuration, migrations, and operational review access.
