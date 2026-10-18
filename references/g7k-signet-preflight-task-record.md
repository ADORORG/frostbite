# Signet preflight (G7k)

Branch `feat/g7k-signet-preflight`, on top of `feat/g7j-delayed-display`; baseline `7ea34b5`. Asked for by the owner: a script that checks what a
first signet run needs, without spending coins.

## What was built

- `tooling/signet-preflight` (`@repo/signet-preflight`), run as `pnpm signet:preflight [--env <file>]`: five read-only checks (settings, template
  hashes, indexer lag, auth-token factory at `4:65517`, estimated publish fee against the ceiling), verdicts `PASS` / `FAIL` / `UNVERIFIED` /
  `SKIPPED`, exit code 0 / 1 / 2. Reuses the platform's own parser (`parseRewardsChainEnvironment`), `rewardsPolicy`, `createRpcNode`,
  `indexingHealth` and the packing/hash functions (now exported from `@ador/chain/bitcoin-alkanes`: `packCode`, `sha256Hex`).
- `tooling/repository-policy`: the tool is listed as an owner of chain-family imports (it checks one family's setup by purpose), with its allow-list test.
- Runbook section "Checking the setup before the first signet run"; package README.

## Evidence

- `@repo/signet-preflight`: typecheck, lint, `test:unit` (22), `test:integration` (2: the real command against a node on a local port), `test:coverage`
  100% statements, branches, functions and lines. 12 mutations of the guarded behaviours (comparison edges, fee rate target, witness discount,
  factory id and null case, hash comparison, exit codes, policy source, working directory) all failed a test, then were restored.
- `@ador/chain` unit (251), `@repo/repository-policy` (31 unit; coverage 96.8% statements, 93.9% branches), `pnpm repository:check` (54 workspaces),
  `@repo/vitest-config` integration (3), `env:check` for the new package. Every new file is under 200 lines.
- Run for real, 2026-10-18, against `https://signet.subfrost.io/v4/jsonrpc` with no template folder: settings PASS; templates FAIL (no files);
  indexer and factory UNVERIFIED ("no backend in sync (served 325681, chain tip 326891)"); fee UNVERIFIED with the quoted rate.

## Limits

- The fee is an estimate (packed size / 4 plus 400 vB framing), not the builder's own price. A real signet run still needs the real quote.
- Not run with real template wasm (they were not built here), so the PASS path for templates is proven by tests, not against the release files.
- `esplora_broadcast` acceptance, instance code hash, wallet signing, staff account and manifest are not checked.
