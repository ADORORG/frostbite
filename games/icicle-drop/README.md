# Icicle Drop

A sliding ice-tile puzzle for the platform's arcade, on a four by four board: slide the tiles with the arrow keys, WASD or a swipe, and
two tiles of a kind join into the next. It is client-only: no server, no network, nothing stored by the game itself (the platform keeps
progress and milestones).

## Layout

```
src/rules/     the rules, as a pure seeded state machine (a GameVerifier): constants, board, state, move, milestones, index
src/session.ts one run as a player plays it, and the run record its moves make
src/screen/    drawing the board, and the keys and swipes
src/main.ts    joins the page to the platform (progress, milestones, runs)
src/replay.ts  the verifier the platform replays runs with (rules + one sample run)
```

## Keys, sound and pause

Arrows or WASD (or a swipe) slide the tiles; Enter starts a run (and never throws away one that is going: the button says "New run"), and P or
Space pause, which blocks moves. A join chimes higher the bigger the biggest tile; the music is a calm loop (`src/audio.ts`, `src/feedback.ts`), and the
panel is at the bottom left. The sound settings are kept beside the best score. None of this is in the rules, so it does not change the digest.

## How runs are checked

A new tile comes from a seeded generator, so the same seed and moves always play out the same way. The platform gives a run its seed,
the game records each move (`left`, `right`, `up`, `down`, then `end`), and on `run.submit` the platform replays the record with the
published verifier. A milestone the replay earns is held as replay-verified, which shows the run followed the rules, not that a person
played it. The verifier's SHA-256 is pinned in `configs/games/icicle-drop.ts`; changing the rules changes the digest, and a test fails
until the pin and `verifierVersion` are updated together. A run holds at most 3,500 moves so a record stays inside the size the platform
accepts.

## Milestones

26, all decided by the state of a run alone (`src/rules/milestones.ts`): tiles from 64 to 4096, score, moves, pairs joined in one move,
streaks of moves that join, and board marks (a big tile in the corner, room to spare, a full board survived, a quick 128). The words are
in the manifest. The owner approved the list on 2026-10-29.

## Tests

`pnpm --filter @game/icicle-drop test:unit`, `test:integration` (bundles the page and runs it against a simulated platform),
`test:coverage`. `test/support/bot.ts` is a plain player that hugs a corner, used to check that the milestones a decent player meets are
reachable and that a record replays to the same result.

## Ownership

Platform games team.
