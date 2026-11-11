# `@frostbite/share`

The Share control: a small, optional button that offers a person the places they can send a link to something they earned, and the
builders that turn a post into each place's address. It knows nothing about games, accounts or what is being shared; the caller makes
the link (`makeLink`) and supplies the words (`text`).

## Public API

- `defineShareConfig({ hashtags, platforms })`: checks a configuration when it is made and returns it. Each platform has an `id`, a
  `label`, an `accent` colour and a short `mark` for its tile, a `template` (an https address with `{url}`, `{text}` or `{textAndUrl}`, filled in percent-encoded) and an optional
  `maxTextLength`. A wrong template stops the platform at start. The platform's own list lives in `configs/share.ts`.
- `platformLink(platform, { hashtags, text, url })`: the address that opens a destination with the post ready to send.
- `fitText(content, maxTextLength)`: the words cut to a destination's limit, the link counted at `countedLinkLength` and the hashtags kept whole.
- `ShareButton` (`@frostbite/share/react`): a small button (or a round one with the mark alone, to sit on a picture) that opens a sheet:
  a bottom sheet on a phone, a dialog on a desktop, so it never makes the thing it sits on longer, and nothing opens by itself. The
  sheet says what is being shared (`heading`, `kicker`, an optional picture), shows a coloured tile for each configured destination
  at once (dimmed while the link is made, then links), the device's own share sheet first on a touch screen, and a link bar with a
  Copy button that says whether it worked (and the address stays selectable when the browser refuses).
- `shareControlCopy`: the control's own words.

## Invariants

- Nothing is hard-coded: destinations, their addresses and limits, and the hashtags are configuration.
- Everything put into a template is percent-encoded, so words with `&`, `#` or a line break cannot add a field or end the address.
- `makeLink` must be a stable function for the same thing (the panel asks again if it changes). No link is made until the control is
  opened, so a page full of buttons makes none.
- Destination links open in a new tab with `noopener noreferrer`.
- The control carries only the words and the link; nothing about who is sharing.

## Configuration

A `ShareConfig`, supplied by the host (see `configs/share.ts`). Destinations' addresses are their documented "share" endpoints and were
not clicked through on a live account when written.

## Tests

`pnpm --filter @frostbite/share test:unit` (builders, configuration, the control in a DOM), `test:integration` (a deployment's
configuration end to end), `test:coverage`.

## Ownership

Platform games domain.
