# `@ador/milestone-art`

Cleans a builder's milestone drawing before it goes on chain. The drawing becomes part of a collectible that players hold and
that pages show, so nothing the builder wrote is trusted: the drawing is read as a strict subset of SVG, every element,
attribute and value is checked against an allow-list, and what is stored is written fresh in one canonical form.

## Public API

- `sanitizeDrawing(drawing, policy)` returns `{ ok: true, svg }` with the cleaned drawing, or `{ ok: false, reason, detail }`.
  The `reason` is a code the caller can act on (`too-large`, `too-complex`, `forbidden-character`, `forbidden-markup`,
  `malformed`, `missing-root`, `unknown-element`, `unknown-attribute`, `bad-value`, `bad-reference`); `detail` is for a person.
- `DrawingPolicy`: `maxBytes`, `maxElements`, `maxDepth`, `maxAttributeLength`. All are arguments: the byte limit must equal the
  `max_art_bytes` the game's contract was initialised with, and none is fixed here.

## What a drawing may contain

One `svg` root with the SVG `xmlns` and a `viewBox`, and inside it only `g`, `defs`, `path`, `circle`, `ellipse`, `rect`, `line`,
`polyline`, `polygon`, `linearGradient`, `radialGradient`, `stop` and `clipPath`, with their geometry and presentation attributes
(`values.ts` lists each and the shape of its value). Colours are hex or a reference to a gradient in the same drawing
(`url(#id)`); every reference must resolve and every id be unique. Printable ASCII only. Refused outright: text, images, `use`,
links, scripts, styles, animation, `foreignObject`, comments, CDATA, doctypes, processing instructions, entities, event handlers,
`style` attributes and external references. A drawing is refused, never repaired.

## Invariants

- Output is canonical: the same drawing in any quoting or spacing cleans to the same bytes, and cleaning clean output changes
  nothing. The root is always written with an explicit `</svg>`, the form the contract requires.
- Anything accepted passes the contract's own check (`rewards_core::art::validate`); `contracts/templates/abi/drawing-vectors.json`
  holds drawings both sides must agree on, and a fuzz test checks the sanitiser's output against the contract's rules.
- Drawings are shown to players only through an image tag, which cannot run scripts, whatever the drawing holds.

## Dependencies and tests

No runtime dependencies. `pnpm --filter @ador/milestone-art test:unit | test:integration | test:coverage`. Platform engineering owns
this package; contract engineering owns the vector file.
