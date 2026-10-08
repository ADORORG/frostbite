# Uploads feature

Contributes the authenticated direct-upload API (intent creation, completion, and the asset library
listing) and the `/studio/uploads` page. Registration receives the platform provider registry
explicitly, so removing its one line detaches the routes, the page, and storage use.

The feature validates HTTP input through `@ador/shared/uploads`, delegates persistence and signing to
`@ador/uploads`, and imports no R2 implementation. Completion exposes only the pending asset ID and
state; it does not claim validation or publication.

Configuration uses the shared typed upload policy. Run `env:check`, `typecheck`, `test:unit`,
`test:integration`, or `test:coverage`. Platform engineering owns this feature.

## Asset pipeline composition

`@ador/feature-uploads/pipeline` exports `createAssetPipelineResolver`, which composes the validation and
processing activities from the typed `object-storage:s3-compatible` and
`media-processing:image-derivatives` capabilities and returns provider-neutral activities for a workflow
host. A failed composition is not cached; the host may pass its own database client and clock.

## Library API

`GET /api/v1/uploads/assets` returns the caller's newest assets (policy `libraryPageSize`, default 48;
no pagination yet, `truncated` says older ones exist) with processing state, rejection reason, and
short-lived signed rendition URLs (policy `derivativeReadLifetimeMs`, default 5 minutes). Signing
failures degrade to `derivativeAccess: "unavailable"` instead of hiding the asset. See ADR-016 for the
bearer-URL trade-offs and the plan to migrate to a streaming route.

## Studio UI (`/studio/uploads`)

The page is organized so each layer can be replaced or tested alone:

- `src/client/` is framework-free: `api-client` (validated HTTP), `file-checks`, `transfer` (an
  `ObjectTransfer` port with an XHR implementation for progress), `upload-state` (a pure reducer),
  `upload-runner` (resumable orchestration), `asset-poller`, `library-refresh`, copy modules
  (`rejection-copy`, `upload-messages`, `asset-presentation`, `purpose-labels`), `client-policy`, and
  `browser-services` (the one bundle of browser dependencies; tests inject fakes).
- `src/ui/hooks/` connects that logic to React (`use-upload-session`, `use-asset-library`).
- `src/ui/components/` holds small presentational components (`upload-form`, `upload-feedback`,
  `upload-panel`, `asset-card`, `asset-grid`, `asset-library-panel`) built from `@repo/ui` primitives.
- `src/ui/uploads-workspace.tsx` is the only client boundary and composition root;
  `uploads-surface.tsx` is the server-rendered page shell.

Retrying an upload reuses its idempotency key, so intent creation and completion are safe to repeat and a
finished transfer is never repeated. The server remains authoritative for type, size, and content.

Tests: `test:unit` runs node tests (`*.unit.test.ts`) and jsdom component tests (`*.dom.test.tsx`).
Browser coverage lives in `tests/e2e` (`uploads.spec.ts` on real services, `uploads-quality.spec.ts`
across viewports).
