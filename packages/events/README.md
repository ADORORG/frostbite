# `@ador/events`

Provider-neutral, versioned domain-event envelopes used by transactional outbox delivery.

## Purpose

Payloads contain non-empty identifier references only; secrets, signed URLs, complete records, and large artifacts are prohibited. Event
identity is stable across delivery retries and audited replay. This package owns no database, workflow-provider, framework, or feature logic.

## Public API

`@ador/events` exports the schemas and the type:

- `domainEventEnvelopeSchema` and `DomainEventEnvelope`: the envelope (`eventId`, `name`, `schemaVersion`, `occurredAt`, `correlationId`,
  `causationId`, `payload`), strict, with the name's `.vN` suffix required to match `schemaVersion`.
- `eventNameSchema`: lower-case dotted names ending in a version, such as `collection.submitted.v1`.
- `eventPayloadSchema`: a non-empty record whose keys end in `Id` and whose values are identifier strings of at most
  `eventIdentifierMaxLength` characters.
- `eventIdSchema`: a UUID.

## Dependencies

`@ador/shared` (the correlation id schema) and `zod`.

## Configuration

None.

## Invariants

- A payload names things by id and never carries their contents.
- Changing a payload's shape is a new version of the event name, never an edit of an old one.
- An event keeps its `eventId` across retries, so a consumer can ignore a repeat.

## Tests

`pnpm --filter @ador/events test:unit`, `test:integration`, `test:coverage`.

## Ownership

Platform engineering.
