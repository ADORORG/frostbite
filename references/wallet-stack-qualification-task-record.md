# Wallet-stack qualification — task record

Status: completed — Converged

Baseline: `bdcfa30853865f910a8952911d219422a885aeb5`
Date: 2026-09-08

## Intended scope

Qualify and exact-pin the accepted LaserEyes React/Core pair and an immutable `@alkanes/ts-sdk`
build before implementing wallet authentication or transaction UI. Qualification must cover the
Next.js browser/server boundary, client bundle contents, P2TR and P2WPKH address vectors, and the
shared wallet capability contract without advertising an untested wallet as supported.

## Accepted compatibility exception

The npm registry currently resolves `@omnisat/lasereyes-react` to `0.0.80`, which depends exactly on
`@omnisat/lasereyes-core` `0.0.85`. The published core package and the current upstream `main`
manifest both depend on:

- `alkanes` from `git+https://github.com/kungfuflex/alkanes.git`; that upstream repository now
  explicitly identifies itself as deprecated and directs TypeScript consumers to
  `@alkanes/ts-sdk`.
- `bitcoinjs-lib` `^7.0.0-rc.0` and `bip32` `5.0.0-rc.0`, which are pre-release ranges rather than
  exact qualified production pins.

The user accepted the deprecated transitive dependency temporarily because the Alkanes ecosystem
integration relies on the published LaserEyes pair. The floating Git dependency is pinned by root
override to commit `7a3326b12702c044424d10b37c048e06ebefb3d2`; application code must not import
its APIs, and no wallet becomes enabled without provider-specific conformance evidence.

## Exit criteria for the exception

Replace the exception when the first viable option becomes available:

1. An upstream LaserEyes React/Core release that replaces the deprecated `alkanes` dependency with
   the immutable Alkanes SDK (or removes protocol-specific transaction construction from core), uses
   supported Bitcoin primitives, and pins compatible security-sensitive versions.
2. An upstream-accepted patch and immutable release containing those changes.
3. A narrowly maintained temporary fork with ownership, update policy, provenance, license
   confirmation, security review, and an exit plan.

Any replacement must rerun the package, browser-bundle, network-vector, and provider conformance
qualification. A package override alone is not evidence of runtime compatibility.

## Sources checked

- npm package metadata for `@omnisat/lasereyes-react@0.0.80`
- npm package metadata for `@omnisat/lasereyes-core@0.0.85`
- current upstream `omnisat/lasereyes-mono` core package manifest
- current deprecation notice in `kungfuflex/alkanes`
- canonical `kungfuflex/alkanes-rs` guidance for immutable `@alkanes/ts-sdk` builds

## Qualification results

- Exact packages: LaserEyes React `0.0.80`, LaserEyes Core `0.0.85`, immutable Alkanes SDK
  `0.1.6-669e7c0`, and `bitcoinjs-lib` `7.0.2`.
- The deprecated Git dependency is fixed to commit
  `7a3326b12702c044424d10b37c048e06ebefb3d2` by root override.
- Compatible security patches override vulnerable Axios, esbuild, qs, and bip32 transitives.
- The remaining high Valibot advisory may be embedded in LaserEyes React's pre-bundled distribution;
  package-level provenance cannot prove otherwise. No provider is enabled by this slice. The
  advisory must be resolved or explicitly accepted before wallet authentication is exposed.
- The isolated provider bundle measures approximately 2.04 MB minified and 612,547 bytes gzip. It
  is constrained to a 650,000-byte gzip ceiling and must remain route-lazy.
- The immutable Alkanes SDK root loads in the Node test runtime. Its broad temporary declaration
  file remains contained behind a concrete server boundary.
- P2WPKH and P2TR mainnet/signet parsing uses `bitcoinjs-lib`, rejects non-canonical/checksum,
  cross-network, unsupported-script, and whitespace inputs, and returns canonical script bytes.
- The signer bridge refuses disconnected, incomplete, and wrong-network state; requests no
  broadcast; signs batches sequentially; and rejects incomplete or unexpectedly broadcast output.
- A strict Next.js 16.3.3 production fixture builds the client boundary and verifies standalone
  server output without retaining generated files.

No individual wallet is enabled by this package-level result. Device/browser tests for each
configured provider remain required before authentication or transaction capability is advertised.

## Audit and verification

The review repaired browser-only address serialization, concurrent wallet prompts, incomplete
connection reporting, stale blocker documentation, missing Next.js build evidence, permissive
generated and unstable fixture configuration, compiler-peer drift, and an unsupported
security-containment claim. Mutation proofs deliberately broke and restored address validation, SDK
identity, signer normalization/state/output/batch ordering, exact LaserEyes bridging, SSR safety,
browser bundle provenance, and standalone Next output; every guarding test failed for its intended
reason.

- Format, environment parity, lint, repository policy, and TypeScript checks passed across all 16
  executable workspaces; native Rust formatting, Clippy, and type checks passed.
- Unit and integration suites passed, including a real PostgreSQL container, the Next.js production
  fixture, nine native contract tests, and four WASM contract tests.
- `@frostbite/chain` and `@frostbite/wallet` measured 100% statements, branches, functions, and lines. Merged
  line and branch coverage exceeded 90%; Rust measured 98.99% lines, 100% functions, and 94.55%
  regions.
- Migration verification, the production build, and 36 Playwright cases passed.
- Repository policy checked 183 files; the largest hand-maintained source/test file was 291 lines.
- Clean-pass streak: M4 producer/consumer contract diff, M5 mutation/runtime proof, then M11
  rule-by-rule audit. Each found no further verified issue and changed nothing.

Commit: `feat: qualify LaserEyes wallet stack`

Verdict: **Converged** — no further verified findings remained in this task's audited scope after
three consecutive clean passes.
