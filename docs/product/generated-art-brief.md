# Generated art in the beta: a clean adapter pattern

Status: draft for the product owner. Owner direction (2026-10-11): generated art, such as small HTML/script
pieces composed on chain, is part of the beta, and must be built with a clean, maintainable pattern such as an
adapter. This brief proposes that pattern and names what it costs. Nothing here is accepted.

## What the owner asked for

A collection's items may be uploaded images (built) or art composed from a small HTML/script, light enough to
live on the chain (Alkanes: on chain; EVM chains: storage, Arweave or IPFS). It has to work for every chain
family without chain-specific code in the studio, review or public pages.

## The pattern: three small ports

Keep the studio, review and public pages ignorant of how art is made or published. They talk to ports, and
each kind of art or chain is one adapter, registered explicitly (no filesystem discovery), schema-validated
and testable, like the other features.

1. **`ContentKind`** (what an item is). Each kind defines its data schema, its validation, its size limits, its
   review view and its preview. Two kinds in the beta:
   - `image`: today's items (asset reference, name, description, traits).
   - `generated-html`: a small self-contained program plus its inputs (seed or per-item parameters), traits,
     name and description.
     A collection has one kind in the beta (decided here for simplicity; see Open).
2. **`ArtRenderer`** (how an item becomes pixels, for preview and review). `image` returns the processed image;
   `generated-html` renders the program in an isolated sandbox with a fixed seed, so the same input always
   produces the same output.
3. **`PublicationStrategy`** (how the content becomes permanent, per chain family). `alkanes-onchain` writes the
   canonical bytes on chain; `evm-storage` (our storage, Arweave or IPFS, configurable) stores the bytes
   content-addressed and records the hash. Each strategy implements `plan` (exact cost, content hash, steps),
   `publish` (idempotent, resumable steps) and `verify` (a third party reproduces the hash).

The submission snapshot already freezes a collection with a payload hash; the content kind and its canonical
bytes become part of what is frozen and hashed, so review, publication and the public page all point at the
same bytes.

## Why generated art is the hard part (and what the pattern must enforce)

Generated art is code supplied by a creator. The images path validates bytes; this path executes them.

- **Sandboxed rendering only.** Rendered in a sandboxed, cross-origin frame with no network, no storage, no
  access to the wallet or session, a strict content-security policy, and a time and memory budget. Never on the
  platform origin (AGENTS.md and the plan say uploaded HTML never runs there).
- **Deterministic.** No time, no randomness except the supplied seed, no external fetch; the same input gives
  the same pixels. A test renders each item twice and compares the result.
- **Small and bounded.** A hard byte limit per program and per item, set per chain family in configuration from
  measured cost; refusal over the limit with a clear message.
- **Reviewed as code.** Staff review shows the program source, a rendered preview of sample items, and the
  hash. A reviewer approves exactly those bytes; any change is a new submission.
- **Hashing.** Canonical bytes are defined (program bytes plus an ordered, canonical encoding of inputs) and
  hashed with SHA-256; the same bytes are published and verified.
- **Preview before cost.** The creator sees the exact rendered output and the exact publication cost before
  anything is signed (plan 8.3).

## Reveal

The owner chose delayed reveal. For generated art this is natural (the program and inputs are published at
reveal), but a committed hash must be recorded first so the reveal can be verified. For on-chain uploaded
images, delayed reveal conflicts with writing the art early; the reveal design has to say which bytes exist
publicly before the reveal and which are only hashed. This must be decided before D13 can be accepted.

## Scope and cost (honest view)

This is the largest addition to the beta. New work, all behind the ports above, none of it started:

1. `ContentKind` contract and registry; the existing image path becomes the first adapter (refactor, no
   behavior change).
2. The `generated-html` kind: schema, creator editor (program, parameters, preview), limits, import.
3. The sandboxed renderer and determinism tests; a security review of the sandbox (a gated qualification,
   like the upload formats).
4. Review screens for code and rendered samples.
5. `PublicationStrategy` and its two first adapters, with the D13 spike providing the real costs and limits.
6. Public page rendering of generated items (sandboxed), and reveal.

Because the plan fixes the beta scope, adding this means the milestone should be amended explicitly rather
than carried as a hidden extension (plan: work must not proceed behind a false completion flag). The owner
should confirm the timeline effect before the Week 5 entry gate is passed.

## Open

- One content kind per collection, or mixed kinds in one collection? (Recommend one per collection in beta.)
- Which chain families ship publication adapters in the beta (Alkanes on chain first, then one EVM chain)?
- The byte limits per chain family (measured by the D13 spike, then set in configuration).
- Whether creators may supply third-party libraries inside the program (recommend no: self-contained only).
- Who qualifies the sandbox (security review) and when, since it gates enabling the kind.

## Suggested order

D14 and D13 records accepted -> `ContentKind` contract with `image` as the first adapter (safe refactor) ->
D13 spike on the target chains -> generated-html kind and sandbox -> review screens -> publication adapters.
