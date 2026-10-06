# Uploads feature

Contributes authenticated direct-upload intent and completion API operations. Registration receives
the platform provider registry explicitly, so removing its one line detaches both routes and storage
use.

The feature validates HTTP input through `@ador/shared/uploads`, delegates persistence and signing to
`@ador/uploads`, and imports no R2 implementation. Completion exposes only the pending asset ID and
state; it does not claim validation or publication. It has no UI yet; W3-06 owns upload interaction.

Configuration uses the shared typed upload policy. Run `env:check`, `typecheck`, `test:unit`,
`test:integration`, or `test:coverage`. Platform engineering owns this feature.

## Asset pipeline composition

`@ador/feature-uploads/pipeline` exports `createAssetPipelineResolver`, which composes the validation and
processing activities from the typed `object-storage:s3-compatible` and
`media-processing:image-derivatives` capabilities and returns provider-neutral activities for a workflow
host. A failed composition is not cached; the host may pass its own database client and clock.
