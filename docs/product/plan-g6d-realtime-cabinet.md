# G6d: a real-time cabinet that can be replayed (task #63)

Status: built on `feat/replayable-realtime-cabinet`. Specification: `docs/product/run-record.md` (the section on SAT SNAKE).

## Goal

Show that a game's real-time cabinet can be checked by the platform's replay, with no change to the platform: port one cabinet
of FROST·BITE to a fixed-step simulation that takes the player's choices by tick, and publish its rules.

## Decisions taken on the documented defaults (review at merge)

1. **The cabinet is SAT SNAKE.** Of the nine real-time cabinets it is the only grid game with a fixed 235 ms step already, its
   state is small, and its mines are drawn on the board, so the replay claim is not undermined by hidden information. The
   others (physics with floating point, canvases, `Math.random` throughout) are not ported.
2. **Beside the game, not inside it.** The legacy files are frozen ("may only shrink"), and the legacy snake is welded to the
   legacy board shell and economy. So, as the ice field did, SAT SNAKE is new compliant code with its own launcher and run, and
   the legacy snake stays as it was (self-reported). Two snakes exist until the legacy one is retired.
3. **Choices by tick, not a tick per record entry.** `turn { dir, tick }`, `end { tick }`. A tick-per-input record would pass the
   64 KB cap in minutes; this one is a few dozen entries. `end` is required for the last stretch to count; the cabinet always
   writes it.
4. **Turning is checked against the way the snake last moved**, not the last key pressed. The original let two quick key presses
   reverse onto the neck and crash; the port refuses the reversal (and the cabinet says so) instead of recording a crash the
   player did not intend.
5. **Differences from the original**, said here because the port is new code: food is never placed on a mine (the original could
   place it there, out of reach), food and mines come from the run's seed (the original used `Math.random` for food), and the
   starting food is drawn rather than fixed at one cell. Edges wrap, the tail cell counts as body, and the clear rows around the
   start are as the original had them.
6. **One verifier per game stays.** Rather than change the platform to hold several verifiers per game, the SDK gained
   `combineCabinets`; a record names its cabinet in `config.cabinet`. The verifier id becomes `frostbite`, version 2; the
   manifest's version goes to 0.4.0 and its digest is re-pinned. The ice-field cabinet's records now carry `cabinet:
"ice-field"`. There is no live deployment, so nothing is migrated.
7. **One new milestone, `snake-ten`** (ten links), declared `replay-verified`. Length 10 is seven foods, a short run.
8. **A run lasts at most 10,000 ticks** (about 39 minutes at the screen's pace), which bounds the work a replay does.

## Out of scope

The other eight cabinets; retiring the legacy snake; a run that survives a page reload; a leaderboard (#54); anything that
makes "a person played it" true (a replay cannot show that).
