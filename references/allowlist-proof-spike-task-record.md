# D15 allowlist proof spike — protocol fixture task record

Status: implemented and verified; D15 remains researching

Baseline: `cccaee2`
Canonical Alkanes revision: `62511e9371a3f9e448841140c51cfe428cfcb955`

## Delivered scope

- A runtime-neutral TypeScript Leaf V1 schema, deterministic codec, strict decoder, and SHA-256
  sorted-pair Merkle primitives under `@frostbite/shared/allowlists`.
- One shared JSON fixture covering P2TR/Bitcoin and P2WPKH/Alkane-shaped inputs.
- An independent Rust spike codec and hash implementation that consumes the same fixture.
- Root contract lint, typecheck, and test commands so the Rust evidence cannot silently drift.
- Positive, negative, malformed, bounds, mutation, root-order, and cross-language tests.

The fixture uses script bytes, not address parsing. ADR-006's qualified address decoder remains the
only permitted source of production script bytes.

## Explicit non-goals and remaining gate

This task does not implement a deployable Alkane contract, claimant authorization, partial claim
accounting, proof generation, snapshot ingestion, benchmarking, LaserEyes signing, SDK broadcast,
indexing, or reorg handling. It therefore does not accept D15 or open any dependent product gate.

The next D15 task is the direct claimant-binding runtime fixture for P2TR and P2WPKH. It must prove
which signed transaction commitment authorizes the exact claim before any allocation state changes;
output-recipient equality is explicitly insufficient.
