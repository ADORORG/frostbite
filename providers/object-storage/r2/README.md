# `@ador/provider-object-storage-r2`

Cloudflare R2 adapter for the platform-owned `ObjectStoragePort`.

## Public API and registration

`createR2ObjectStorage` accepts validated configuration and returns only the provider-neutral port.
`r2ObjectStorageProvider` is the explicit one-line registration used by the platform provider list.
Removing that registration detaches the provider without changing features or domain packages.
The registry resolves the same process-local `ObjectStoragePort` through the typed
`object-storage:s3-compatible` capability and validates configuration only when that service is used.

## Configuration

The adapter exclusively owns `R2_ENDPOINT`, `R2_REGION`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_PRIVATE_BUCKET`, and `R2_PUBLIC_BUCKET`. The two bucket names must differ.
Credentials and bucket names never enter browser bundles or platform records.

## Invariants and operations

Presigned uploads target only the private bucket and bind the exact key, content type, and byte
length. Reads and writes remain streamed. Public writes and private-to-public copies use atomic
destination preconditions. Only the R2 S3-compatible operations qualified here are supported;
multipart upload, lifecycle cleanup, public URL construction, and media policy belong elsewhere.

Cloudflare's destination-conditional `CopyObject` header is an R2 extension currently documented as
beta, so deployment qualification against R2 remains a release requirement. Platform engineering
owns this provider. Integration and coverage scripts start an exact-image-pinned disposable MinIO
service for standard S3 protocol conformance; the R2-only copy extension uses a wire-level harness.
Run `env:check`, `typecheck`, `test:unit`, `test:integration`, or `test:coverage`.

## Local development and the real-R2 checklist

Locally and in tests the adapter talks to a disposable MinIO (`@ador/test-kit/s3-runtime`). Plain `http`
is accepted for `R2_ENDPOINT` only on a loopback address and only when `APP_ENV` is not `preview` or
`production`; the endpoint then uses path-style addressing. Everything else must be `https`.

Before pointing an environment at real R2, in the Cloudflare dashboard:

1. Create two buckets (private drafts and public assets) and use the S3 endpoint
   `https://<account-id>.r2.cloudflarestorage.com`. Presigned URLs do not work on custom domains.
2. Create an R2 API token with object read and write on both buckets; put its key pair in
   `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, and set `R2_REGION=auto`.
3. Add a CORS rule to the **private** bucket for the application origin, because the browser uploads
   directly with a presigned `PUT`:

   ```json
   [
     {
       "AllowedOrigins": ["https://app.example.com"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

4. Run the smoke script with the same environment the application will use (it needs
   `PUBLIC_BASE_URL`, the origin the CORS rule must allow):

   ```sh
   pnpm --filter @ador/provider-object-storage-r2 smoke
   ```

   It uploads and reads back one throwaway object through every supported path, verifies the CORS
   preflight for the application origin, exercises the R2-only conditional copy, checks that deleting a missing key succeeds (abandoned-upload
   cleanup relies on it), and deletes the object. It prints PASS or FAIL per check and exits non-zero on any failure. The conditional-copy
   header is a beta Cloudflare extension; treat a failure there as a release blocker.

## Ownership

Platform engineering.
