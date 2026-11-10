# Milestone drawings: a guide for admins

A milestone can carry a drawing. When an admin defines the milestone on a game's contract, the drawing is written on chain, and it becomes
part of the collectible a player holds when they mint the milestone. Pages show it too. Because of that, the platform never writes the
drawing you supply: it **reads it as a strict subset of SVG, checks every element, attribute and value against an allow-list, and writes
out a fresh canonical copy.** A drawing that uses anything outside the list is **refused, not repaired**, with the first problem it met.

The checks live in `packages/milestone-art` (`sanitizeDrawing`), and the staff step calls them before it builds any transaction
(`packages/game-admin/src/plan.ts`). A drawing is optional: a milestone defined without one is allowed. The complexity limits come from
configuration (`configs/game-admin.ts`); the byte limit is set per game (see Limits).

## Why `role` (or any attribute) is refused

"Attribute role is not allowed" means the `<svg>` tag, or another tag, carries an attribute that is not on the list below. `role`,
`aria-label` and `aria-*` are accessibility hints for web pages. They are not on the allow-list, so they are refused like any other
unknown attribute (`unknown-attribute`), even though they would be harmless in a browser. A milestone's name and description come from
the game's manifest, not from the drawing.

The check reports **the first problem only**. Fixing one and trying again can reveal the next. Use the checklist below to clear them
all at once.

## What a drawing may contain

**One `<svg>` root** with `xmlns="http://www.w3.org/2000/svg"` and a `viewBox` of four numbers, width and height above zero.

**Elements:** `svg` (the root only), `g`, `defs`, `path`, `rect`, `circle`, `ellipse`, `line`, `polygon`, `polyline`,
`linearGradient`, `radialGradient`, `stop`, `clipPath`.

**Attributes:** `clip-path`, `clip-rule`, `cx`, `cy`, `d`, `fill`, `fill-opacity`, `fill-rule`, `fx`, `fy`, `gradientTransform`,
`gradientUnits`, `height`, `id`, `offset`, `opacity`, `points`, `preserveAspectRatio`, `r`, `rx`, `ry`, `spreadMethod`, `stop-color`,
`stop-opacity`, `stroke`, `stroke-dasharray`, `stroke-dashoffset`, `stroke-linecap`, `stroke-linejoin`, `stroke-miterlimit`,
`stroke-opacity`, `stroke-width`, `transform`, `viewBox`, `width`, `x`, `x1`, `x2`, `y`, `y1`, `y2`, and `xmlns` on the root.

**Values** must be exactly one of these shapes. Nothing is trimmed or rewritten.

- `fill` and `stroke`: `none`, a hex colour (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), or `url(#id)` pointing at a gradient in the same
  drawing. `stop-color` takes a hex colour only (not `none`, not `url`). Names such as `red` and functions such as `rgb(...)` are
  refused.
- `width`, `height`, `x`, `y`, `x1`, `x2`, `y1`, `y2`, `cx`, `cy`, `r`, `rx`, `ry`, `fx`, `fy` and `offset`: a number, with an optional
  `%`. `stroke-width`, `stroke-dashoffset` and `stroke-miterlimit`: a number only. `stroke-dasharray`: `none` or a list of numbers.
  `points`: a list of numbers.
- `transform` and `gradientTransform`: only `translate`, `scale`, `rotate`, `skewX`, `skewY` and `matrix`, with plain numbers.
- `id` and the id in `url(#id)`: a letter first, then letters, digits, `_` or `-`, at most 32 characters. An `id` may be used only once,
  and every `url(#id)` must point at an `id` that exists in the same drawing (`bad-reference` otherwise).
- Path data (`d`): only path letters, digits, signs, dots, commas and spaces.
- `opacity`, `fill-opacity`, `stroke-opacity` and `stop-opacity`: `0` to `1`.
- `fill-rule` and `clip-rule`: `nonzero` or `evenodd`. `stroke-linecap`: `butt`, `round` or `square`. `stroke-linejoin`: `miter`, `round`
  or `bevel`. `gradientUnits`: `userSpaceOnUse` or `objectBoundingBox`. `spreadMethod`: `pad`, `reflect` or `repeat`.

**The text itself** is read as a strict subset of XML (`packages/milestone-art/src/xml.ts`): printable ASCII plus tab, newline and
carriage return; elements with quoted attributes (single or double quotes) and nothing between them but whitespace; no repeated
attribute on one element; no `<` or `&` inside a value.

**Limits.** Four, all checked: bytes, elements, nesting depth and the length of one attribute value.

- **Bytes** are the game's own limit: the drawing size the game's contract was created with, which cannot exceed the platform ceiling
  (`maxDrawingBytes` in `configs/rewards-policy.ts`). The size is measured on what you supply and again on the cleaned copy.
- **Elements** (the root included), **depth** (the root is depth 1) and **attribute length** come from `drawingLimits` in
  `configs/game-admin.ts`.

Read the numbers from those files rather than from this page.

## What is refused

| You have                                                                | Do this instead                                                                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `role`, `aria-label`, any `aria-*`, `class`, `style`, `data-*`          | Remove them. They are not drawing (`unknown-attribute`).                                 |
| `<?xml ...?>`, `<!DOCTYPE>`, comments (`<!-- -->`), CDATA               | Delete them. Design tools add them on export (`forbidden-markup`).                       |
| Prefixed names: `xlink:href`, `xmlns:xlink`, `inkscape:*`, `sodipodi:*` | Delete them. A name may hold only letters, digits and `-`, so these fail as `malformed`. |
| `<use href="#shape"/>`, `href`                                          | Write the shape out where it is used. Links and references to other content are refused. |
| `<text>`, `<tspan>`                                                     | Convert text to outlines (paths). Fonts are not on chain.                                |
| `<image>`, `<a>`, `<script>`, `<style>`, `<animate*>`, filters          | Not allowed. Use shapes and gradients only.                                              |
| Colour names, `rgb(...)`, `hsl(...)`, `currentColor`                    | Use a hex colour.                                                                        |
| Units such as `px`, `em`, `pt` on `width`, `height`, `x`, `y`           | Use plain numbers (a `%` is the only suffix accepted, and not on `stroke-width`).        |
| An `id` used twice                                                      | Make each id unique (`bad-reference`).                                                   |
| Text between elements, an unquoted attribute value                      | Not valid in this subset (`malformed`).                                                  |
| A second `<svg>` inside the drawing                                     | One `<svg>` only. Use `<g>` to group.                                                    |
| An `xmlns` anywhere but the root                                        | Remove it.                                                                               |
| A `url(#id)` with no matching `id`                                      | Add the gradient or clip path, or remove the reference.                                  |

Refusal codes you may see: `too-large`, `too-complex`, `forbidden-character`, `forbidden-markup`, `malformed`, `missing-root`,
`unknown-element`, `unknown-attribute`, `bad-value`, `bad-reference`. The staff page shows "The drawing was refused." with the sentence that names the
element or attribute (for example "Attribute role is not allowed."); it does not show the code.

## Before you define the milestone

1. Export the drawing as **plain SVG** from your design tool (Figma, Inkscape, Illustrator). Use inline attributes, not CSS classes or
   style blocks, and keep ids short.
2. Convert strokes you rely on and all text to outlines. Flatten anything the tool leaves as a reusable symbol, `<use>` or filter.
3. Open the file in a text editor and clear the list in "What is refused": the XML declaration and comments at the top, the root's
   `role` and `aria-label`, every `href`, and every `<use>`, `<text>` and `<style>`.
4. Check the root has `xmlns` and a `viewBox`, that every `url(#id)` has a matching `id`, and that colours are hex.
5. Check the size against the limit. A drawing is also measured after cleaning, so leave some room.
6. Type or paste the drawing into the milestone's field on the staff page. The field is always open, and **Define** is available only once there is a
   drawing; **Without a drawing** is the separate, deliberate choice (the collectibles then show a generated picture, for good). After the
   step confirms, the platform reads the drawing back from the contract and compares it with what you signed: a milestone shows
   "Defined with a drawing" only when the contract holds exactly that, and the step fails with an explanation when it does not.
7. Try it in the staff page's define-milestone step before you sign anything. A refused drawing stops before a transaction is built, so
   it costs nothing. A drawing that passes is written to the chain once: the platform refuses to define the same milestone again
   ("This milestone is already defined on the contract and cannot be defined again."), so **check it before you sign.**

## Defining many milestones at once

A game with many milestones can be done from a folder instead of one field at a time. On the staff page, **Define many milestones**:

1. **Name each file for its milestone.** `first-win.svg` is the drawing of the milestone `first-win` (the id on the milestone list, case of
   the `.svg` ending does not matter). Choose the whole folder in one go, or drop the files on the box.
2. **Read the list before anything starts.** Every drawing is checked now, against the same rules and the same limits the platform holds a
   single drawing to (this contract's own size limit included), so each refusal shows beside its milestone with the first problem
   it met. Files that match no milestone are named. Two files for one milestone are refused rather than guessed between. A milestone
   the contract already has is left out, and a milestone with no file is left alone (define it on its own, with or without a drawing).
3. **Press "Define N milestones".** The platform then defines them one at a time, in the manifest's order. Each becomes an ordinary step
   that you review and sign in the wallet that holds the game's auth token. The next is not built until the last has been confirmed
   on the network (its step shows Complete), because the chain will not build a step from an output it has not confirmed. So expect one signature per milestone and
   about one block between them. **Pause after this step** stops the run; the step already under way carries on.
4. **If a step fails, or the platform refuses to build one,** the run stops at that milestone and says so; fix what the step shows and
   press **Continue**. A step that failed before the run began is tried again when you start.
5. **After a reload** nothing is lost: choose the folder again. Milestones already defined are skipped, and a step still waiting to be
   signed is waited for (open it from the log).

The drawing rules above are unchanged: a refused drawing is refused here too, and a drawing that is signed is written to the chain once.

## Who can define a milestone

Defining a milestone spends the game's auth token, which is held by the wallet that created the game's contract. Sign with that wallet.
See the staff page for the step and `packages/game-admin/README.md` for what each step checks.
