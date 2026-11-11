# The run record: how a milestone is replay-verified

Status: **built and tested** (G6, task #41, and the claim path G6c, task #62, 2026-10-15). A signed-in player can start a
run, play it from a seed the platform issued, submit its record once, and have the milestones it earned held on their
account as `replay-verified`. This document is the answer to the open question in `game-host-interface.md` section 7, "the
shape of a deterministic run record for replay verification", and describes the claim path that uses it (section "The claim
path" below; the plan is `plan-g6c-claim-path.md`).

## What replay verification is, and is not

A game that is **deterministic** can record what the player did, and the platform can replay it on its own server with the
game's own rules and see what it earned. That is the `replay-verified` level of `game-host-interface.md` section 4.

- **It shows** that the recorded inputs were legal at every step, and that they lead to the claimed result.
- **It does not show** that a person played them. A program can write a legal record. Replay stops _impossible_ results
  (a mine-free field that was not, a glacier nobody could afford), not _scripted_ ones. Rate limits, server-issued seeds
  and single use narrow that, and the product never describes a replay-verified milestone as proof of human play (the
  page says "Replay-checked", and what that does and does not show).
- **Nothing that carries value depends on a self-reported milestone** (guardrail, unchanged). A replay-verified one may.

## The record

A strict JSON document, defined and validated by `@frostbite/game-sdk/run-record`:

| Field                         | Meaning                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`               | `1`.                                                                                                                                           |
| `gameId`                      | The game (a slug). The platform holds one verifier per game and looks it up by this id.                                                        |
| `verifier`, `verifierVersion` | Which platform-held rules replay it, and which version of them. A record made under another version is refused, never replayed.                |
| `seed`                        | An integer from 0 to 2^32-1. All of the run's randomness comes from it, so every JavaScript engine reproduces it exactly.                      |
| `config`                      | The game's own settings for the run (for example `{ "mines": 5 }`), JSON only. The verifier checks every key and refuses one it does not have. |
| `inputs`                      | The player's steps in **logical order**, each `{ type, data? }`. There is no time in it: a step is a step, never a timestamp. At most 5,000.   |
| `claims`                      | The milestone ids the game says the run earned (at most 64). Every claim must be among what the replay earned.                                 |

Canonical form: keys sorted by code unit, no whitespace (`canonicalJson`). The same record is always the same text, so
it can be stored once, measured (at most 64 KB of UTF-8) and hashed. Its **digest** is the SHA-256 of that text, in hex.

A game builds a record with `createRunRecorder({ gameId, seed, verifier, verifierVersion, config })`, calling
`input(type, data?)` as the player acts and `finish(claims)` at the end. `finish` checks the record against the schema,
so a game cannot hand over one the platform would refuse for its shape.

## The verifier

A verifier is a **pure state machine** (`GameVerifier<State>`, also in the SDK so a game needs nothing from the
platform to write one): `init(seed, config)`, `step(state, input)`, `earned(state)` and, for a game that ranks scores, `score(state)`. Each step either gives the next
state or refuses the input with a reason. It uses its own seeded generator and nothing else: **no clock, no
`Math.random`, no network, no storage**. It never throws for an input; it refuses.

It is **the game's own code, published with the game and pinned by the manifest**; the platform contains none of it. A game
publishes its rules by having `src/replay.ts` (a default export of the `GameVerifier`, and a named export `sample()` returning
one legal run). The SDK's build turns it into `verifier.js` and `verifier.json` (`{ bytes, id, sha256, version }`) beside the
game. The game's manifest pins them (`verification: { replay: { id, sha256, version } }`, which needs the `run:submit`
capability and at least one milestone with `verification: "replay-verified"`), and a test fails until the pin matches what the
source builds. The platform loads the file by that digest (`@frostbite/game-verification/loader`): a file whose hash differs, whose
identity differs from the manifest's, or whose sample run does not verify is not loaded, and its game stays self-reported (the
reason is logged at startup). The game's browser bundle is never executed on the server; only this file is.

Who runs it matters: the artifact is the game's code, running on our server. Today only the platform's own games (`embedded`,
built from this repository and reviewed) are loaded, replayed by an in-process runner with a per-call time limit (`node:vm`),
**which is not a security boundary**. A game from anyone else is not loaded and none is planned to be (ADR-018 Amendment 2): outside games stay
self-reported, and the loader says so rather than loading them.

## What the platform does with a record (`verifyRun`)

`verifyRun(registry, raw, policy)` takes untrusted input and answers a verdict for any value; it never throws. In order:

1. The record must be well formed (`malformed`), within the size limit (`too-large`) and the input limit
   (`too-many-inputs`). The caller limits the body before parsing it.
2. It must name the verifier the platform holds for that game (`unknown-verifier`), at that version (`version-mismatch`).
3. The replay must accept the settings (`invalid-config`) and every input (`illegal-input`, with the index of the first
   one refused). A verifier that fails is reported as such (`verifier-error`), not as a verdict on the run.
4. Every claim must have been earned (`claim-not-earned`).

The answer is `verified` (every milestone the replay earned, the digest, and the score the replay reached: a whole number from 0 up once the run has ended, `null` before that or for a game that keeps none; the platform keeps it on the run and a leaderboard ranks only these, never a number the game reports) or `rejected` (a reason, a detail and the
digest where there is one). A milestone the replay earned that the game did not claim is simply not claimed.

## Conformance

Every registered verifier passes `runVerifierConformance` (run by `apps/web/test/verifiers.unit.test.ts`) against its
sample run: it verifies its own sample, refuses a claim it did not earn, refuses an input the game does not have, gives the
same verdict every time, uses neither the clock nor `Math.random` (the check makes both throw), and answers a verdict, not
an error, for odd inputs. A game cannot be registered without proving this.

## The claim path

Generic: the platform names no game. A game is client-only and reaches it only through the SDK.

1. **`run.start()`** (capability `run:submit`) asks the platform for a run. A signed-in player is given
   `{ runId, seed, expiresAt }`: a random 32-bit seed, bound to the digest of the verifier the platform has loaded for that game.
   Otherwise the game is told `unavailable` with why (`signed-out`, `not-supported`, `too-many-open-runs`) and plays on a seed of
   its own, **self-reported**. At most `maxOpenRuns` (3) runs are open per player and game; a run lives `runLifetimeMs` (24 h).
2. The game plays from that seed and builds its record (`createRunRecorder`).
3. **`run.submit(runId, record)`** hands the record over once. The platform replays it and answers `verified` (with the
   milestones it earned that the manifest declares replay-verifiable), `rejected` (with the reason) or `refused` (nothing was
   replayed: `already-submitted`, `expired`, `stale`, `unknown-run`).
4. A verified verdict **and** the milestones it earned are written in one transaction. A milestone the player already held as
   self-reported is upgraded and keeps its unlock time and count; a verified level is never lowered, and a browser that sends
   the level in a sync is read as self-reported, so only a replay can create it.

Rules the platform holds the run to: a run is settled once (a row lock, so two submissions at once settle one); a record for a
seed other than the issued one is rejected without a replay, and a claim of a milestone the manifest does not declare
replay-verifiable is rejected without one; every submission that reaches a verdict spends the run; a run whose game's rules
changed since it was issued is `stale` and spent; the canonical record is kept up to 64 KB for audit (retention of rejected
ones is not implemented yet). Over HTTP: `POST /api/v1/games/runs/start` and `POST /api/v1/games/runs/submit` (signed in,
same origin, rate limited, bodies read under a 1 MiB ceiling before parsing); the records and runs are in `frostbite.game_runs`.

Scope in this version: milestones earned once. Repeatable milestones and ones with a target stay self-reported. A game with
**hidden information** (the layout of mines) stays peekable: see the limit below. The platform cannot detect that, so the page
describes exactly what was checked, and leaderboards (task #54) will require a game to declare it has none.

## FROST·BITE (removed 2026-11-06): what was verified, and what could not be

The game this section describes is no longer in the repository (task PD-2); the section is kept as the record of how the pattern was proved, and the paths below no longer exist.

FROST·BITE's rules for the pick-based **ice field** and the **icicle economy** are a deterministic core
(`games/frostbite/src/verifier`): a 5x5 field with seeded mines, picks that score safe tiles and end on a mine, settling a
board to bank icicles by the game's own payout formula, and building glaciers at their tier costs. It can earn:

| Milestone       | Decided by the rules?                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `first-win`     | **Yes**: a board settled with a safe pick and no mine.                                                                |
| `first-glacier` | **Yes**: the first tier built, which needs 300 icicles won on boards.                                                 |
| `first-cashout` | **No, by design**: the cash-out is a simulation event (a diesel pot with no chain behind it). It stays self-reported. |

**The ice-field cabinet is in the game** (task #61, `games/frostbite/src/ice-field`): a launcher and panel beside the game
that plays through `iceFieldRules` and builds its run with `createRunRecorder`. Its record is accepted by the registered
verifier (`apps/web/test/verifiers.unit.test.ts`, and a real-browser test that plays in the platform's frame and has the
platform verify what the page produced). It keeps its own icicles and glaciers, apart from the game's legacy economy.

**FROST·BITE adopts the claim path (task #62).** Its manifest declares `run:submit`, pins the verifier it publishes
(`src/replay.ts`, id `ice-field`) and marks `first-win` and `first-glacier` replay-verifiable. A signed-in player's cabinet
starts a run on the platform's seed, and when they end the run it submits the record; the platform replays it and the two
milestones are held as replay-verified on their account. Signed out (or when the platform has no run to give), the cabinet
plays on a seed of its own and says its milestones are the game's own report. It still reports a milestone to the platform's
milestone bridge as soon as it is earned, so a player sees it at once as self-reported and sees it upgraded after the replay.
`first-cashout` is never upgraded.

**A real-time cabinet, ported (task #63): SAT SNAKE.** The game's nine other cabinets are real-time canvas games driven by an
animation loop and elapsed time, with `Math.random` in places and round seeds from `Date.now()`, so they cannot be replayed as
they are. The pattern for porting one, proved on the snake (`games/frostbite/src/snake`, rules in `src/verifier/snake.ts`):

- **The rules know ticks, not time.** One tick is one move. The screen runs a timer (`tickMs`, 235 ms, the cabinet's old
  pace) and calls the same `moveOnce` the server calls; the clock decides how fast the game feels and never what a record
  means. All randomness is a seeded stream the state carries (`stepSeed`), so the same seed and choices give the same game.
- **The record holds choices, not moves.** `turn { dir, tick }` points the snake from a tick; `end { tick }` closes the run. The
  snake just keeps going between choices, so a record is a few dozen inputs instead of one per tick. `end` is what makes the
  last stretch count, so the cabinet always writes it (a crash writes it too).
- **Replay cost is bounded**: a run may last at most 10,000 ticks, and the record caps (5,000 inputs, 64 KB) apply as ever.
- **Nothing is hidden**: the mines are drawn on the board, so unlike the ice field the "followed the rules" claim is close to
  the whole truth. It still does not show that a person steered: a program could play the same legal moves.
- **Several cabinets, one verifier.** The platform holds one set of rules per game, so FROST·BITE publishes one verifier,
  `frostbite` (version 2), built with the SDK's `combineCabinets`: a record names its cabinet in `config.cabinet`
  (`ice-field` or `sat-snake`) and that cabinet's rules replay the rest. The platform learned nothing about either.
  Any change to any cabinet's rules raises the version and changes the pinned digest.
- **Milestone `snake-ten`**: the snake grew to ten links; declared `replay-verified` in the manifest.

The legacy snake inside the game's boards is untouched (the legacy files are frozen) and stays the game's own report; SAT SNAKE
is a cabinet beside the game, like the ice field, with its own launcher and its own run. Eight real-time cabinets are not ported.

**A limit replay cannot remove.** The seed is known to the player's browser and the rules are public, so the browser knows
where the mines are, whoever chose the seed. Replay shows a record is _legal_, not that the player did not read the layout.
Server-issued seeds stop a player choosing an easy board; they do not fix this for a hidden-information board, because the
rules that place the mines are deterministic and public. A game whose result depends on hidden information is the builder's to secure
client side, or should be a game of skill rather than concealment (a platform dealer was considered and dropped, ADR-018 Amendment 2). FROST·BITE's ice
field is a hidden-information board, so its "Replay-checked" label means exactly "the run followed the rules", which the page
says; nothing that carries more than the self-reported class of reward may depend on it, and a leaderboard should not treat it as proof of skill.

## Limits (typed policy)

`maxInputs` and `maxRecordBytes` in `@frostbite/game-verification/policy`, never above the SDK's ceilings (5,000 and 65,536).
They bound the work before a replay starts; a verifier is expected to do work proportional to the inputs it is given, and
a record has at most `maxInputs` of them.
