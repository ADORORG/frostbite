# The ice-field cabinet in FROST·BITE (G6b)

Branch `feat/ice-field-cabinet`, on top of `feat/replay-verification`; baseline `d5665cf`. Plan:
`docs/product/plan-g6b-ice-field-cabinet.md`. Specification: `docs/product/run-record.md`.

## What it is

A playable cabinet beside the game: a launcher button, and a panel with a 5x5 field of frost tiles. Pick tiles (a mine ends
the board; safe tiles show how many mines are next to them), settle the board to bank icicles, spend icicles on a glacier,
end the run to see its record. It plays through the same rules the platform replays (`iceFieldRules`) and writes every
accepted input into a run record with the SDK's recorder. It has its own icicles and glaciers; the legacy economy is a
separate system and is not merged with it (a merged economy could not be replayed).

## Decisions taken on the documented defaults (review at merge)

- **Mounted from outside the legacy code.** New, compliant code under `games/frostbite/src/ice-field/`, attached by
  `main.ts` with a root of its own. No legacy file was edited (checked after every formatting run).
- **A pure session controller** (`session.ts`) wraps the rules and the recorder with no UI: a refused input changes nothing and
  is not recorded, so a record is always a legal run; the record can be taken at any time; each milestone is announced once.
  The React screen only draws it.
- **It does not make FROST·BITE verified.** No claim path exists (#62). The cabinet reports `first-win` and `first-glacier`
  through the game's milestone bridge, which is self-reported, and says so on screen; it never uses the word "verified"
  (a test checks).
- **The frame's policy shaped it:** `style-src 'self'` means classes only, no inline styles (a test checks every rendered
  tree, and the real-browser test fails on any policy violation other than the known wallet probe); no clipboard permission,
  so the record sits in a read-only box that selects itself.
- **Classic JSX, not the automatic runtime:** `jsx: "react"` with an explicit `React` import in each file, so the bundler
  compiles the legacy files exactly as before.
- **The seed is the player's browser's** (`crypto.getRandomValues`). A seed the browser holds also tells it where the mines
  are, and server-issued seeds would not fix that for a hidden-information board. Written into the specification as a limit
  replay cannot remove.
- **Layout:** two columns when there is room (board left; stats, buttons and messages right), one column on narrow screens.
  The first, stacked layout pushed the buttons out of view in the game frame (about 500 px tall); found by looking at a
  screenshot.

## What was built

`session.ts`, `neighbours.ts` (adjacent-mine counts and the camel-case mark names), `seed.ts`, `ice-board.tsx`,
`ice-controls.tsx`, `record-view.tsx`, `ice-field.tsx`, `mount.tsx`, `ice-field.css`; `main.ts` mounts it and
`styles.css` imports the stylesheet; `iceFieldGameId` shared by the sample run and the cabinet; `jsdom` as a dev dependency.

## Verification (run on this branch)

- Mutation proof: 25 guards broken one at a time and restored (what is recorded and what is not, the counted steps, the
  announced milestones, the settle outcomes, the glacier limits, the neighbour counts, the screen's disabling, revealing,
  Escape, focus and mark names, the record's wording and canonical form, the seed's width, and the record the platform checks).
  24 were caught; the survivor was an equivalent mutation (clearing an old record that is never shown), so the dead line was
  removed. The tree was unchanged afterwards.
- Tests: session and neighbours (unit), the screen in jsdom (idle, playing, busted, settled, glaciers, record, focus, no inline
  styles, no "verified"), mounting and the seed, the bundled game against the simulated platform (the cabinet is on the page,
  plays a board, the milestone reaches the host, the record is a legal run, first-cashout is never reported), web unit tests
  that the registered verifier accepts what the cabinet's session records and refuses tampering, and a real-browser test that
  plays in the platform's frame, sees the platform show the milestone, and has the platform's verifier accept the record
  read from the page (three consecutive runs green).
- `pnpm format:check`, `pnpm lint` (45 workspaces, 1,411 files, repository policy included) and `pnpm typecheck`: passed.
  Web unit tests: 75 passed.
- The full e2e suite on the final build: 378 passed, 113 skipped (project-specific), and one failure, my own new screenshot
  test, whose baseline pre-dated the two-column layout; regenerated and stable over three runs. No existing FROST·BITE or
  games baseline changed.
- Coverage: `@game/frostbite` 98.3/93.1/100/100.

## Found along the way

- My throwaway looks-check spec, a stale screenshot of the first layout, and the real-browser test each found a real issue
  the unit tests could not: the platform's milestone dock overlays the bottom of the stage (the test now checks the dock last,
  as a player would); the stacked panel was too tall for the frame.
- The platform page reports one known policy message (the wallet library's `eval` probe); the cabinet's browser test excludes
  exactly that message so any other violation still fails.

## Open

- Nothing can submit the record (#62), so the milestones stay self-reported. Real-time cabinets cannot be replayed (#63).
