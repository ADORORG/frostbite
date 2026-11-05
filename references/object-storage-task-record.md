# W3-01 — Provider-neutral object storage and R2 adapter

Status: completed — Converged  
Baseline: `b63cc13e32e86dca47a00a077857a91c57fa4213`  
Baseline worktree: clean  
Started: 2026-09-13

## Objective

Create the smallest provider-neutral object-storage boundary required by ADR-004, plus an explicit,
detachable Cloudflare R2 adapter that uses only the supported S3-compatible operations qualified by
tests.

## Done criteria

1. Domain and application consumers depend only on concrete platform-owned storage types and an
   `ObjectStoragePort`; no R2 URL, SDK type, bucket name, or credential escapes the adapter.
2. The boundary supports exact-key presigning, metadata lookup, streamed reads and writes,
   conditional private-to-public copy, and deletion without buffering untrusted objects.
3. Private draft/quarantine and public approved-derivative buckets remain separate, validated
   configuration values; public writes are conditional and fail closed on an existing key.
4. The R2 adapter is registered explicitly in one line and can be detached without changing domain
   or feature modules.
5. Unit and integration tests cover success, missing objects, invalid configuration, conditional
   conflicts, provider failures, and stream behavior through the public boundary.
6. Environment templates, package documentation, workspace scripts, and provider conformance
   evidence remain synchronized; repository gates pass and this diff converges under deep review.

## Approach

Define a narrow storage package containing owned identifiers, operation inputs/results, failure
categories, and the port. Implement R2 as a nested provider package using the AWS SDK v3 S3 client,
with dependency injection around the small command and presigning boundary. Keep configuration and
provider registration in the adapter so later provider replacement is a registration change rather
than a product rewrite.

## Risks and boundaries

- Keys and buckets must not be interchangeable, and exact requested keys must survive signing.
- Missing objects, conditional-write conflicts, invalid provider responses, and transient provider
  failures require stable platform error categories rather than leaked SDK exceptions.
- Streams must remain streams across the boundary; this task will not implement file validation,
  browser upload authorization, multipart upload, cleanup policy, or public URL construction. Those
  belong to W3-02 through W3-07.
- R2's partial S3 compatibility means only operations exercised by conformance tests are supported.
- Deployment qualification against a real R2 account remains an environment-specific release gate;
  local integration evidence must not be presented as production qualification.

## Audit and landing

### Delivered

- Added the provider-neutral `@frostbite/object-storage` port with validated exact keys, streamed bodies,
  stable errors, metadata lookup, private upload presigning, conditional publication, and deletion.
- Added the detachable `@frostbite/provider-object-storage-r2` adapter, exact-pinned AWS SDK dependencies,
  explicit one-line registration, validated server-only configuration, and synchronized environment
  templates.
- Qualified ordinary S3 operations against an exact-image-pinned disposable MinIO service and the
  R2-only destination-copy condition through a signed wire-level harness.
- Made publication retries idempotent only when the existing public ETag is the exact validated
  source ETag; a different version remains a conflict.

### Deep-review findings repaired

1. Replaced a self-confirming package integration fake with a real public-export resolution check.
2. Bound publication to the source ETag so validated content cannot change before copying.
3. Calculated presigned expiry from the signing start so a slow signer cannot overstate validity.
4. Tightened bucket validation to R2's current lowercase naming constraints.
5. Generalized precondition errors because either source or destination conditions may fail.
6. Added deterministic fake-timer cleanup.
7. Added missing live S3 conformance rather than treating wire serialization as service evidence.
8. Reconciled lost-response publication retries without permitting destination replacement.
9. Added an uppercase-only bucket test after mutation proved the prior mixed-invalid fixture could not
   isolate that invariant.

### Verification evidence

- `pnpm env:check`, `pnpm format:check`, `pnpm lint`, and `pnpm typecheck`: passed.
- `pnpm test:unit` and `pnpm test:integration`: passed, including real PostgreSQL, pinned MinIO, and
  native plus wasm contract tests.
- `pnpm build`: passed.
- `pnpm test:coverage`: passed; merged TypeScript/Rust line and branch coverage remained greater than
  90%. The R2 workspace reported 98.98% statements, 93.93% branches, 100% functions, and 100% lines;
  the object-storage contract package reported 100% for all four measures.
- `pnpm test:e2e`: 86 passed and 6 intentionally gated tests skipped across four viewports.
- Repository policy: passed for 24 workspaces and 358 files; every changed handwritten source/test
  file remained below 300 lines. `pnpm install --frozen-lockfile` confirmed lockfile consistency.

### Mutation and clean-pass evidence

Mutations removing object-key control-character rejection, lowercase-only bucket validation,
conditional write serialization, ETag-based retry discrimination, and nested provider discovery each
made its guarding test fail, then the exact restored tests passed. Three consecutive post-interruption
passes found no further defect or change: producer/consumer contract tracing, dynamic mutation proof,
and the repository-rule/configuration/dependency audit. Verdict: **Converged**.

Landing commit: this task's `feat(storage): add provider-neutral R2 storage` commit.
