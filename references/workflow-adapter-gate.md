# Gate record: signed workflow adapter

Status: lifted 2026-10-06 by the recorded exception in ADR-014; implementation tracked as `W3-05A`

## Reason

The maintained official Inngest SDK version evaluated on 2026-09-06 installs deprecated transitive
packages. Adding it would violate the repository dependency policy. Replacing the SDK with a
hand-written event or signing protocol would weaken correctness and drift from ADR-003.

## Available foundation

- `@frostbite/jobs` owns provider-neutral relay policy, retry classification, and publication/store
  ports.
- `@frostbite/database` adapts the transactional PostgreSQL outbox to the relay store port.
- Domain events and business state remain independent of workflow-provider types.
- No provider capability is registered and no environment key implies the adapter is operational.

## Re-entry criteria

Implementation may resume only when all of the following are evidenced:

1. An official, maintained SDK release has no deprecated installed dependency, or a repository-rule
   exception is explicitly approved and recorded.
2. The exact SDK and transitive graph pass license, maintenance, compatibility, and vulnerability
   review and are pinned in the lockfile.
3. Signed endpoint rejection, stable event identity, duplicate delivery, retry exhaustion, provider
   outage, database acknowledgement failure, and recovery are covered by meaningful tests.
4. Adapter tests run against the real local workflow runtime, and all workspace quality gates pass.

This gate defers only the signed workflow-provider adapter. It does not reopen D06 or change
ADR-003's accepted target architecture.

## Resolution (2026-10-06)

Re-entry criterion 1 was satisfied by an exception explicitly approved by the product and engineering
owner and recorded in `docs/decisions/ADR-014-inngest-sdk-dependency-exception.md`, scoped to the two
deprecated transitive packages that `inngest` 4.21.1 installs. Criteria 2-4 remain requirements of
task `W3-05A` and are evidenced in `references/workflow-adapter-task-record.md`.
