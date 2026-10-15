# The run record: how a milestone is replay-verified

Status: **spike built and tested** (G6, task #41, 2026-10-15). Nothing in the product reads a run record yet: the claim
path that submits one is task #62. This document is the answer to the open question in `game-host-interface.md`
section 7, "the shape of a deterministic run record for replay verification".

## What replay verification is, and is not

A game that is **deterministic** can record what the player did, and the platform can replay it on its own server with the
game's own rules and see what it earned. That is the `replay-verified` level of `game-host-interface.md` section 4.

- **It shows** that the recorded inputs were legal at every step, and that they lead to the claimed result.
- **It does not show** that a person played them. A program can write a legal record. Replay stops _impossible_ results
  (a mine-free field that was not, a glacier nobody could afford), not _scripted_ ones. Rate limits, server-issued seeds
  and single use (task #62) narrow that, and the product must never describe a replay-verified milestone as proof of
  human play.
- **Nothing that carries value depends on a self-reported milestone** (guardrail, unchanged). A replay-verified one may.

## The record

A strict JSON document, defined and validated by `@ador/game-sdk/run-record`:

| Field                         | Meaning                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`               | `1`.                                                                                                                                           |
| `gameId`                      | The game (a slug). A verifier is bound to one game; a record for another is refused.                                                           |
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
platform to write one): `init(seed, config)`, `step(state, input)` and `earned(state)`. Each step either gives the next
state or refuses the input with a reason. It uses its own seeded generator and nothing else: **no clock, no
`Math.random`, no network, no storage**. It never throws for an input; it refuses.

It is **platform code**: held in `configs/verifiers.ts`, reviewed by pull request like a game manifest, registered one
explicit line per game together with a **sample run**. The game's browser bundle is never executed on the server.

## What the platform does with a record (`verifyRun`)

`verifyRun(registry, raw, policy)` takes untrusted input and answers a verdict for any value; it never throws. In order:

1. The record must be well formed (`malformed`), within the size limit (`too-large`) and the input limit
   (`too-many-inputs`). The caller limits the body before parsing it.
2. It must name a verifier the platform holds (`unknown-verifier`), for that game (`wrong-game`), at that version
   (`version-mismatch`).
3. The replay must accept the settings (`invalid-config`) and every input (`illegal-input`, with the index of the first
   one refused). A verifier that fails is reported as such (`verifier-error`), not as a verdict on the run.
4. Every claim must have been earned (`claim-not-earned`).

The answer is `verified` (every milestone the replay earned, and the digest) or `rejected` (a reason, a detail and the
digest where there is one). A milestone the replay earned that the game did not claim is simply not claimed.

## Conformance

Every registered verifier passes `runVerifierConformance` (run by `apps/web/test/verifiers.unit.test.ts`) against its
sample run: it verifies its own sample, refuses a claim it did not earn, refuses an input the game does not have, gives the
same verdict every time, uses neither the clock nor `Math.random` (the check makes both throw), and answers a verdict, not
an error, for odd inputs. A game cannot be registered without proving this.

## FROST·BITE: what is verified, and what cannot be yet

FROST·BITE's rules for the pick-based **ice field** and the **icicle economy** are a deterministic core
(`games/frostbite/src/verifier`): a 5x5 field with seeded mines, picks that score safe tiles and end on a mine, settling a
board to bank icicles by the game's own payout formula, and building glaciers at their tier costs. It can earn:

| Milestone       | Decided by the rules?                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `first-win`     | **Yes**: a board settled with a safe pick and no mine.                                                                |
| `first-glacier` | **Yes**: the first tier built, which needs 300 icicles won on boards.                                                 |
| `first-cashout` | **No, by design**: the cash-out is a simulation event (a diesel pot with no chain behind it). It stays self-reported. |

**The shipped game does not use this core yet.** Its nine cabinets are real-time canvas games driven by an animation loop
and elapsed time, with `Math.random` in places and round seeds from `Date.now()`, so they cannot be replayed as they
are. Until the ice-field cabinet is in the game (task #61) and the claim path exists (task #62), every FROST·BITE
milestone is, and must be shown as, **self-reported**. Porting a real-time cabinet to a fixed-step simulation is task
#63.

## Limits (typed policy)

`maxInputs` and `maxRecordBytes` in `@ador/game-verification/policy`, never above the SDK's ceilings (5,000 and 65,536).
They bound the work before a replay starts; a verifier is expected to do work proportional to the inputs it is given, and
a record has at most `maxInputs` of them.
