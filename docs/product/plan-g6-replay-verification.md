# Plan: replay verification, the run record spike (G6, task #41)

Status: **building on the documented defaults** (owner away, 2026-10-15). Branch `feat/replay-verification`, stacked on
`feat/wallet-widget`. It is a spike: it settles the shape of a run record and proves the replay pipeline on the first
game, and says plainly what the first game cannot yet do.

## 1. What the owner decided

- A milestone has a **verification level**; today `self-reported`. The first verified level is **`replay-verified`**: the
  game is deterministic and the platform re-checks a recorded run on its own server (`game-host-interface.md` section 4
  and 7). Nothing of value may depend on a self-reported milestone.
- **FROST·BITE is the first verified game**; its board generation must be made deterministic (survey 8).
- Leaderboards are verified-only, so **no boards until this exists** (SDK-2 waits for G6).
- The open question this task answers: **the shape of a deterministic run record** (interface doc, section 7).

## 2. What the code says about FROST·BITE (read 2026-10-15)

| Fact                                                                                                                                                                                                                             | Consequence                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board **generation** is already seeded (a small linear congruential generator, `mk(seed, n, total)`; `genMaze(seed)`).                                                                                                           | Good: layouts are reproducible from a seed.                                                                                                           |
| Round seeds come from `Date.now()` (`freshSession(Date.now(), ...)`), and there are 72 `Math.random()` calls (chaos mode mines, dog-mode bones, effects).                                                                        | Seeds must be recorded, not read from the clock; gameplay randomness must be seeded.                                                                  |
| The nine cabinets (`sats`, `maze`, `buster`, `zapper`, `breaker`, `snake`, `climb`, `runner`, `stack`) are **real-time canvas games** driven by an animation loop with elapsed time; the score is whatever the physics produced. | They are **not replayable as they are**. Each would have to be ported to a fixed-step simulation that takes the player's inputs by tick. Not a spike. |
| Boards settle when a **block timer** fires (`setInterval(advanceBlock)`), and the economy is tangled into one 1,000-line React component.                                                                                        | The economy has to be pulled out as pure functions to be checked.                                                                                     |
| `first-cashout` is a **simulation event** (a diesel pot and a glacier conversion with no chain behind them).                                                                                                                     | Verifying it proves nothing real. It stays self-reported; nothing may depend on it.                                                                   |
| `first-win` ("a board settled with a safe score and no mine") and `first-glacier` (spending 300 icicles on the first tier) are **pure arithmetic over a board and a sequence of choices**.                                       | These two can be verified once the board and economy are a pure core.                                                                                 |

## 3. Decisions (defaults, review at merge)

1. **The run record** is a small strict JSON document: `{ schemaVersion, gameId, verifier, verifierVersion, seed,
config, inputs, claims }`. `inputs` is an ordered list of `{ type, ... }` steps in **logical order** (no wall-clock
   time anywhere: a step is a step, not a timestamp). `claims` are the milestone ids the game says the run earned.
   Limits (bytes, steps) are typed policy. It is canonicalised (sorted keys, no whitespace) and hashed (SHA-256) so a
   record can be stored once, compared and referred to.
2. **The verifier is platform code, not game code.** The platform imports a deterministic core a game exports
   (`./verifier`), registered by one explicit line in `configs/verifiers.ts`, reviewed by pull request like a manifest.
   The record names the verifier and its version; a mismatch is refused. The game's browser bundle is never trusted
   or executed on the server.
3. **The record is hostile input.** The replay is bounded (a step budget, a size limit), never throws on bad input,
   and answers a typed result: `verified` with the milestones the replay earned, or `rejected` with a reason. A claim
   the replay did not earn is rejected; a milestone the replay earned that the game did not claim is simply not
   claimed.
4. **A verifier is a pure state machine**: `init(seed, config)`, `step(state, input)` (refusing an input that is not
   legal in that state), `earned(state)`. No clock, no randomness except the seeded generator it owns, no I/O.
5. **First slice for FROST·BITE:** a deterministic **ice-field board** (5x5 tiles, seeded mines, pick a tile, bust on a
   mine) and the **icicle economy** (the game's own payout formula and the first glacier tier's cost, as pure
   functions). It verifies `first-win` and `first-glacier`. It is the pick-based "predictive minefield" the game is
   described as, **not** the real-time cabinets, and the plan says so wherever it is used.
6. **Not in this spike:** wiring a record into the sync route and the database (a verified level on the milestone
   record), a protocol method for a game to submit a record, an ice-field cabinet in FROST·BITE's interface that
   records its own run, and porting any real-time cabinet. Each is filed as its own task.

## 4. Phases

1. `@frostbite/game-sdk/run-record`: the record schema, limits, canonical JSON and a recorder a game can build a record
   with.
2. `@frostbite/game-verification` (platform): the verifier contract, a registry, the bounded replay, the digest.
3. FROST·BITE's deterministic core (`games/frostbite/src/verifier`) and its registration.
4. Conformance: every registered verifier must verify its own sample run and refuse the standard hostile records.
5. Docs: the record specification, the findings, the follow-up tasks; mutation proof and gates.

## 5. Tests

Unit: canonical form (key order, determinism, no whitespace), schema (strict, limits, unknown fields, wrong types),
recorder, digest stability and sensitivity, registry (duplicate id refused), replay (verified, claim not earned,
illegal input, over budget, unknown verifier, version mismatch, oversize, malformed), the core (seeded layout is the
same for the same seed and different for another, bust, win, economy arithmetic equals the game's formula, tier cost),
and a property check that the replay of a recorded legal run always verifies. Mutation proof on every guard.

## 6. Risks

- A verified level on a game whose real play is not verified would mislead. The record and the docs name what was
  verified (the ice-field board and the economy), and the milestone stays `self-reported` in the product until a
  cabinet records its own runs.
- A cheating game can still submit a **legal-looking** record it never played (a record is a claim about inputs, not
  proof of a human). Replay proves the inputs are legal and lead to the claimed result, nothing more; it stops
  impossible results, not scripted ones. Rate limits, per-seed single use and server-issued seeds (so a player cannot
  choose an easy board) belong to the claim path and are listed as follow-ups.
