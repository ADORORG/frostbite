# Creator admission feature

Detachable creator onboarding and staff-review surfaces plus HTTP operations. Register `creatorAdmissionFeature` once in the platform feature registry; removing that line removes its pages and routes.

The feature owns composition only. Domain rules live in `@ador/creator-admission`, contracts in `@ador/shared/creator-admission`, persistence in the Drizzle adapter, and visual grammar in `@repo/ui`.

It contributes authenticated creator-application navigation and capability-gated review navigation.
It requires authenticated pages, API routes, PostgreSQL configuration, and the `creator:review`
capability for review operations. It never grants project publication, deployment, launch, mint, or
game permissions.

Run `pnpm env:check`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, and `pnpm test:coverage` from this package.

## Pages and operations

- `/studio/creator-application` — the applicant's page (draft form, or read-only status card once sent).
- `/admin/creator-applications` — the review queue: groups (all, needs review, approved or paused, finished) with counts, and three sort orders, paged by an opaque keyset cursor.
- `/admin/creator-applications/[applicationId]` — one application: the version sent, the decisions the state allows, and its history (private notes included; staff only).
- Operations: `mine`, `saveDraft`, `submit`, `review`, `reviewQueue`, `reviewRead`. The queue and read are `creator:review` and also refuse a missing actor; a cursor the list did not produce is refused with `invalid_request`.
- Browser code (`src/client`, `src/ui/hooks`) reaches the API only through `createCreatorReviewApi`, which validates every response against the shared schema; services are injectable for tests.

## Ownership

Platform front end.
