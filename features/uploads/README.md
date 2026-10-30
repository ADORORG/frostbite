# Uploads feature

Contributes the authenticated direct-upload API (intent creation, completion, and the asset library
listing) and two studio pages: `/studio/uploads` (the library, filtered by purpose, each ready image with a
"Use in a collection" link) `/studio/uploads/new` (adding an image) and `/studio/uploads/[assetId]` (one image in full). Registration receives the platform provider registry
explicitly, so removing its one line detaches the routes, the page, and storage use.

The feature validates HTTP input through `@ador/shared/uploads`, delegates persistence and signing to
`@ador/uploads`, and imports no R2 implementation. Completion exposes only the pending asset ID and
state; it does not claim validation or publication.

Configuration uses the shared typed upload policy. Run `env:check`, `typecheck`, `test:unit`,
`test:integration`, or `test:coverage`. Platform engineering owns this feature.

## Presentation helpers

`@ador/feature-uploads/context` exports `createUploadsContextResolver`, the database and storage an
uploads-backed feature needs (collection studio and collection review use it instead of repeating it).
`@ador/feature-uploads/presentation` exports the pure helpers that explain a `LibraryAsset` to a person
(`assetBadge`, `assetNote`, `pickRendition`, `describeDimensions`), so other studio pages that show the
creator's images describe them in the same words.

`@ador/feature-uploads/inline` exports `InlineUpload`, a client component that uploads one image for a
fixed purpose inside another page (the collection wizard's image slots). It reports the asset only once it
is processed; refused or still-processing images are not offered for use.

`@ador/feature-uploads/bulk` exports `BulkUpload`, a client component that uploads many images of one purpose
at once. Every file is sent under its own name (kept with the asset as `fileName`, so a list of items can name
its images) and has its own idempotency key and state, so one failure never stops the others. The batch keeps
at most as many unfinished uploads as the server allows per person (`activeIntentLimitPerUser`) and at most
`bulkInFlightLimit` files under way at all, starting the next as room appears; one shared watcher checks all of
them with a single library read per interval. A batch takes up to `bulkFileLimit` files. `onProcessed` reports
each image once it is processed, and `onSettled` once when the batch comes to rest.

## Asset pipeline composition

`@ador/feature-uploads/pipeline` exports `createAssetPipelineResolver`, which composes the validation and
processing activities from the typed `object-storage:s3-compatible` and
`media-processing:image-derivatives` capabilities and returns provider-neutral activities for a workflow
host. A failed composition is not cached; the host may pass its own database client and clock.

## Abandoned-upload cleanup

`@ador/feature-uploads/cleanup` exports `createUploadCleanupResolver`, which composes
`@ador/uploads`'s cleanup service from the typed `object-storage:s3-compatible` capability and
returns it lazily (a failed composition is not cached). The worker runs it periodically; see the
package README for the rules and the access policy for private drafts.

Resolvers share one helper, `memoizeUntilFailure` (`src/lazy.ts`): build on first use, share the
result, forget a failure.

## Library API

`GET /api/v1/uploads/assets` returns the caller's newest assets (policy `libraryPageSize`, default 48;
no pagination yet, `truncated` says older ones exist) with processing state, rejection reason, and
short-lived signed rendition URLs (policy `derivativeReadLifetimeMs`, default 5 minutes). Signing
failures degrade to `derivativeAccess: "unavailable"` instead of hiding the asset. See ADR-016 for the
bearer-URL trade-offs and the plan to migrate to a streaming route.

## Studio UI (`/studio/uploads`)

The page is organized so each layer can be replaced or tested alone:

- `src/client/` is framework-free: `api-client` (typed routes on the shared `@ador/client-http` requester), `file-checks`, `transfer` (an
  `ObjectTransfer` port with an XHR implementation for progress), `upload-state` (a pure reducer),
  `upload-runner` (resumable orchestration), `asset-poller`, `library-refresh`, copy modules
  (`rejection-copy`, `upload-messages`, `asset-presentation`, `purpose-labels`), `client-policy`, and
  `browser-services` (the one bundle of browser dependencies; tests inject fakes).
- `src/ui/hooks/` connects that logic to React (`use-upload-session`, `use-asset-library`).
- `src/ui/components/` holds small presentational components (`upload-form`, `upload-feedback`,
  `upload-panel`, `asset-card`, `asset-grid`, `asset-library-panel`) built from `@repo/ui` primitives.
- `src/ui/library-workspace.tsx` and `new-upload-workspace.tsx` are the client boundaries and composition
  roots of the two pages; `uploads-surface.tsx`, `new-upload-surface.tsx` and `uploads-frame.tsx` are the
  server-rendered page shells.

Retrying an upload reuses its idempotency key, so intent creation and completion are safe to repeat and a
finished transfer is never repeated. The server remains authoritative for type, size, and content.

Tests: `test:unit` runs node tests (`*.unit.test.ts`) and jsdom component tests (`*.dom.test.tsx`).
Browser coverage lives in `tests/e2e` (`uploads.spec.ts` on real services, `uploads-quality.spec.ts`
across viewports).

## Ownership

Platform front end.
