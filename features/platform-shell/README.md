# `@frostbite/feature-platform-shell`

The first registered platform feature. It owns the public shell capabilities currently rendered
by the web application: primary navigation and the public landing page.

Its manifest declares its page and operation contributions, while the lazy entrypoint supplies
their implementations. Primary navigation is the validated aggregate contributed by every enabled
feature; this feature does not own a hard-coded product menu.

## Public API

The package exports `platformShellFeature`, a validated registration consumed by
`configs/features.ts`. Its entrypoint is lazy-loaded through `@frostbite/plugin-kit`. The
`@frostbite/feature-platform-shell/status` subpath exposes the framework-neutral `/api/v1/platform`
operation.

The home page (`/`) is a hero over a moving scene (`@frostbite/scenes`) followed by whatever parts the features contributed
(`PageRenderContext.homeSections`): a rail of launches, of collections and of games today. A part that fails to draw is left out and
reported (`home.section_failed`), so one rail cannot take the page down. The status panel states only what is true (the feature count,
and launches as gated).

Register or detach the complete feature through the single entry in `configs/features.ts`.

## Dependencies and configuration

It depends on shared contracts, the HTTP operation boundary, and plugin kit. It owns no environment
variables, database state, provider adapter, or product policy. Fastify is test-only evidence for
the accepted extraction target.

## Invariants

- The manifest and loaded entrypoint have the same ID, version, and capabilities.
- Declared capabilities represent implemented behavior; unfinished launch actions remain gated.
- Platform status reports only the foundation stage and gated transactional state.

## Verification

Run `pnpm --filter @frostbite/feature-platform-shell typecheck`, `test:unit`, `test:integration`, or
`test:coverage`. Platform engineering owns this foundation feature.

## Ownership

Platform front end.
