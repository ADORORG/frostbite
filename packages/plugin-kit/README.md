# `@ador/plugin-kit`

Explicit feature/provider registration, boot validation, dependency checking, and lazy loading.

## Public API

- `defineFeature(registration)` validates one manifest at its declaration boundary.
- `createFeatureRegistry(registrations)` creates an immutable public registry interface.
- `@ador/plugin-kit/lazy` exports `memoizeUntilFailure`: build a feature's shared dependency on first use,
  share it, and forget a failed build so a later call can retry.
- `FeatureRegistration` and `FeatureEntrypoint` define the plugin boundary.
- Feature entrypoints own pages and framework-neutral HTTP operations; apps use generic dispatchers.
- `@ador/plugin-kit/providers` defines and creates explicit provider registries.
- `@ador/plugin-kit/boot` validates decision gates, provider requirements, pages, routes, and
  operation IDs before serving.
- `@ador/plugin-kit/navigation` filters validated manifest navigation for public, authenticated, or
  capability-authorized users, returns each link with its `area` in display `order`, and
  `markCurrent` marks the link for the page being shown (longest matching parent). Visibility never
  replaces destination authorization.

Applications register a feature by importing its registration and adding it to
`configs/features.ts`. The registry never scans the filesystem or activates modules through import
side effects.

## Invariants

- IDs are unique.
- Every dependency exists and dependency graphs are acyclic.
- A loaded entrypoint must match its manifest identity, version, and capabilities.
- Loading is explicit and lazy.
- Required provider capabilities must exist at boot.
- Exactly one provider owns each capability; typed runtime services match declared capabilities and
  repeated resolution returns the same process-local instance.
- Neutral contract packages own capability-to-service type mappings; provider adapters only implement
  them, so replacing an adapter does not change feature imports.
- Required decision gates must be open before a feature or provider can register at boot.
- Method/path pairs and operation IDs are globally unique; parameter names do not hide collisions.
- Routes are static until the shared HTTP contract defines typed path-parameter validation.
- Page paths are declared in manifests, globally unique at boot, and match loaded entrypoints.
- Navigation is manifest-owned and immutable; detaching a feature removes its links with its pages.

Removing the single registration entry from `configs/features.ts` removes that feature's pages and
operations. Runtime filesystem discovery and feature-specific app routes are intentionally absent.

## Verification

Run `pnpm --filter @ador/plugin-kit typecheck`, `test:unit`, `test:integration`, or
`test:coverage`. Platform engineering owns the registry contract.
