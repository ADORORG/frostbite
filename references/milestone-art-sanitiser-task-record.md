# The milestone drawing sanitiser (G7e-4)

Branch `feat/g7e-4-svg-sanitiser`, stacked on `feat/g7e-2-alkanes-reads` (baseline `54ddc4f`). Task #77, part of #73.

## What it is

`@ador/milestone-art` cleans a builder's milestone drawing before it is put on chain by the platform. The drawing is read as a strict
subset of SVG (elements with quoted attributes; no text, comments, CDATA, doctype, instructions or entities; printable ASCII), every
element, attribute and value is checked against an allow-list, references must resolve, and the result is written fresh in one
canonical form. A drawing is refused with a code and a reason, never repaired.

## Decisions taken on the documented defaults (review at merge)

- **Reject, do not repair, and write fresh.** Cleaning by deleting bad parts is how scripts survive; here nothing the builder wrote
  reaches the chain except values that matched an allow-list.
- **No text, images, `use`, links, style or animation in v1.** Text needs fonts that are not on chain; the others are the usual routes to
  active or external content. Adding any is a new allow-list entry with tests, not a loosening.
- **Colours are hex or a gradient reference** (no named colours, `rgb()` or external urls).
- **Limits are arguments** (`maxBytes` must equal the contract's `max_art_bytes`); no number is fixed in the package.
- **A hand-written parser, no dependency.** The accepted language is small enough to read in one file; a general XML parser would accept
  more than the allow-list wants and add a dependency to audit.
- **Pages show drawings only through an image tag** (scripts do not run there): this package is the first of two defences, the contract's
  check the second.

## What the checks found

- A fuzz test (6,000 mostly valid, sometimes damaged or hostile drawings, checked against the contract's rules restated as an oracle) found a
  real fault on its first run: an empty drawing was written with a self-closed root, `<svg .../>`, which the contract refuses. The root is
  now always written with a closing tag, and `drawing-vectors.json` carries the empty form for the contract's test.
- 45 mutants: 31 killed at once; the others exposed missing tests (the delete character, the edges of a viewBox and of opacity, an empty
  transform, a stop colour that is a reference, `none` for a dash array, and the exact size when a self-closed root grows by six bytes)
  and error texts that no test read; all are now covered and killed. One mutant was equivalent (a namespace check made redundant by an
  earlier one) and the code was simplified instead.

## Not done

- Wiring the sanitiser into the platform path that defines milestones (the build path, task #76); a place for builders to preview a
  cleaned drawing (the local development host could call it).

## Gates (run 2026-10-16)

- Package: `lint`, `typecheck`, `test:unit` (83), `test:integration` (2), `test:coverage` (100% lines, functions and statements; 96.92% branches).
- `pnpm repository:check` (49 workspaces, 1661 files), `pnpm format:check`: pass. `contracts/templates/ci.sh lint`, `coverage` and
  `build.sh --check` pass (the Rust change is a test only; code hashes are unchanged).
- The rest of the repository was not rerun: this task adds one package and a vector file and changes no other code.
