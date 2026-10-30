# `@ador/provider-media-processing-sharp`

`sharp` adapter for the platform-owned `ImageProcessor` port (ADR-013). It decodes untrusted images in
an isolated process and returns normalized WebP thumbnails and previews.

## Public API and registration

`sharpMediaProcessingProvider` is the explicit one-line registration used by `configs/providers.ts`; it
provides the typed `media-processing:image-derivatives` capability. Removing the line detaches the
provider without changing features or domain packages. `createSharpImageProcessor(policy)` composes
the real Node launcher around the bundled worker; `createIsolatedImageProcessor({ launcher, policy,
schedule })` is the injectable orchestration used by tests and any alternative launcher.

## Structure

- `isolated-processor.ts` orchestrates one worker per request: heap cap, wall-time kill, bounded
  output, exit handling. `process-launcher.ts` is the port plus the Node implementation.
- `reply.ts` validates every worker reply against the request (count, kinds, order, byte caps, size
  boxes, payload length). `protocol.ts` is the length-prefixed frame format.
- `handle-request.ts` is the worker's pure request handler; `process-image.ts` is the only code that
  imports `sharp`; `worker.ts` is a thin stdin/stdout shell.

## Behavior and invariants

- The worker starts with only `NODE_ENV` in its environment (nothing ambient reaches it); stderr is discarded; no decoder message is surfaced.
- Decoding is strict (`failOn: warning`), enforces the pixel limit, and requires the header size to
  equal the recorded size. EXIF orientation is applied; metadata is stripped; images are never
  enlarged.
- A file that exhausts a limit is rejected with `processing-limit-exceeded`: our wall-time or output-cap
  kill, or a worker that dies by signal or abort (what an out-of-memory file looks like). A
  deterministic decode problem is `decode-failed` or `decoded-size-mismatch`.
- A worker that exits with one of its own failure codes (cannot start, for example a missing native
  decoder or worker file, or a protocol violation), a malformed worker reply, or a launch failure
  rejects the promise. Those are platform faults, never recorded as file outcomes, so a bad deployment
  cannot permanently reject uploads.
- A hard RSS limit is a deployment responsibility; concurrency is bounded by the caller.

## Configuration

None of its own: limits come from the typed derivative policy in `@ador/shared/uploads`. The worker is
a TypeScript file run with Node type stripping; a bundled deployment must ship it alongside.

## Tests

`test:unit` (fake launcher and scheduler, reply table, protocol, image processing), `test:integration`
(real worker, misbehaving worker scripts, registry resolution), `test:coverage`. Platform engineering
owns this provider.

## Ownership

Platform engineering.
