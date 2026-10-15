# Plan: the ice-field cabinet in FROST·BITE (G6b, task #61)

Status: **building on the documented defaults** (owner away, 2026-10-15). Branch `feat/ice-field-cabinet`, stacked on
`feat/replay-verification`. It puts the deterministic core from G6 in front of a player and has the game record its own
run, so the platform's verifier has a real record to check.

## 1. What it is, and is not

- **It is** a playable cabinet inside FROST·BITE: a 5x5 field of frost tiles, pick tiles, a mine ends the board, settle to
  bank icicles, spend icicles on a glacier. It plays **through the same rules the platform replays**
  (`iceFieldRules`), so what the player does and what the server checks cannot drift apart. As the player acts, the game
  builds a **run record** with the SDK's recorder.
- **It is not** the game's real-time cabinets, and it does not touch them. It has **its own icicles and glacier**, kept by
  the core: the legacy economy (chaos, modes, diesel, a block timer) is a different system and is not merged with it.
  A merged economy could not be replayed.
- **It does not make FROST·BITE verified.** There is no way yet to submit a record (task #62). The cabinet reports
  `first-win` and `first-glacier` through the game's existing milestone bridge, which is **self-reported**, and the cabinet
  says so on screen. What it adds is a record that **can** be replayed once submission exists, and a record a builder can
  read.

## 2. Decisions (defaults, review at merge)

1. **Mounted from outside the legacy code.** The legacy files may only shrink (`src/legacy/README.md`), so the cabinet is
   new, compliant code under `src/ice-field/`, attached to the page by `main.ts` with its own root element and a launcher
   button. No legacy file is edited.
2. **A pure controller, then a thin screen.** `session.ts` wraps the rules and the recorder with no UI in it: an input is
   recorded only if the rules accepted it; the record can be taken at any time; earning a milestone is announced once.
   The React screen only draws it and forwards clicks. This keeps the part that matters testable without a browser.
3. **The seed is the player's browser's** (`crypto.getRandomValues`), kept in the record. A player's browser knowing the seed
   means it knows where the mines are: **replay cannot stop a player reading the layout.** Server-issued seeds do not fix
   that for a hidden-information board either, because the rules are public and deterministic. Stating this is part of
   the task; the claim path (#62) and the choice of games to verify must account for it (a game whose result depends on
   hidden information needs a secret the player does not hold, or a game of skill rather than concealment).
4. **Adjacent-mine numbers are shown** on safe picked tiles (the classic hint), computed from the same layout. It does not
   change the rules; it makes the board a game of reading, not of guessing.
5. **The frame's policy is strict** (`style-src 'self'`, no inline styles, no scripts but its own file, no clipboard
   permission). The cabinet uses classes only, loads its CSS from the game's stylesheet, and shows the record in a
   read-only text box to select and copy by hand.
6. **Truthful labels.** The cabinet never says "verified". It says the milestone is the player's own claim today and that
   the record can be replayed by the platform once submission opens.
7. **Accessibility:** tiles are buttons with names and states; the status line is a live region; the launcher is a toggle
   with `aria-expanded`; Escape closes and returns focus; reduced motion is respected.

## 3. Phases

1. The session controller and its tests (including: its record verifies through the platform's `verifyRun`).
2. The screen: launcher, panel, board, controls, record view, CSS; component tests.
3. Mounting in `main.ts`, the bundled-game integration test, and an end-to-end test that plays in the real frame, takes the
   record out of the page and has the platform's verifier accept it.
4. Docs, task record, findings, mutation proof, gates.

## 4. Tests

Unit: the controller (accepted and refused inputs, only accepted inputs recorded, settle outcomes, glacier, milestone
announced once, record verifies), the camel-case mark names, the neighbour counts. Component (jsdom): idle, playing, busted,
settled, glacier affordable or not, record view, Escape and focus, truthful label. Integration: the bundled game shows the
launcher and plays a run against the simulated platform, and the milestone reaches the host. e2e: in the real frame, play
until a board is won, end the run, read the record, and have `verifyRun` accept it. Mutation proof on the controller and the
screen's guards.

## 5. Not in this task

Submitting the record (#62), a verified label, server seeds, porting any real-time cabinet (#63), merging with the legacy
economy, sound and animation beyond a reduced-motion-safe flash.
