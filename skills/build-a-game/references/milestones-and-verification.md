# Milestones and replay-checking

## The manifest

One `defineGame({...})` record, validated when the platform starts. Fields: `schemaVersion: 1`, `id` (lower-case words joined by
hyphens; the page address and every record's key), `title`, `summary` (one sentence for the list), `tags` (one to four kinds from the platform's list as `gameTags` lists them in the platform's shared games module: action, arcade, developer, endless, platformer, puzzle, reflex, rhythm, strategy; the games page searches and filters by them), `description`, `version`, `network`
(a chain the platform is configured for), `launch: { mode: "embedded" }`, `capabilities`, `cover`, optional `scene` (a name from the
platform's scene library, which refuses to start with a name it does not have), `milestones`, and for a rewarding game `rewards` and
`verification`. Strict fields: an unknown one is refused.

Capabilities come from a known list: `wallet` (the player's public address), `run:submit` (submit runs for replay),
`milestone:claim` (ask the platform to start a claim; needs `rewards`).

## Milestones

```ts
{
  id: "first-level",       // unique within the game; at most 64 milestones; ids the game's code actually unlocks
  title: "First level",
  description: "You finished the first level.",
  criteria: "Finish level 1.", // shown to players: how it is earned
  claimPolicy: "once",     // or "repeatable" (needs maxCount)
  // target: 10,           // "once" only: the game reports a running total; earned at 10
  // maxCount: 100,        // required for "repeatable"
  // verification: "replay-verified",
}
```

- Every text is bounded; write concrete, short criteria a player can act on.
- Design milestones the rules can decide: thresholds on score, count, time, distance, a clear, a no-hit run. Spread them so most players
  earn some and a few earn all. Make the hard ones reachable by a perfect run, and test that they are.
- A published milestone never changes. A change to a milestone is a new game `version`.

## Self-reported or replay-verified

The platform cannot see inside a game, so a milestone is the game's own report (`self-reported`) unless the platform replays the run.
**Nothing that carries money or a privilege (a reward, access, a ranking prize) may depend on a self-reported milestone.**

To make milestones `replay-verified` (only for milestones earned once, with no target, that the rules decide):

1. Write the rules as a `GameVerifier` (`<sdk>/run-record`): `init(seed, config)`, `step(state, input)`, `earned(state)`.
   Inputs are `{ type, data }`; refuse an input with a reason (`refuse`) instead of throwing. Take the tick of each input from the input
   and replay the ticks between. A run is closed with an `end` input; a run that is not closed is not counted past its last choice.
2. `src/replay.ts`: `export default rules; export const sample = sampleRun;` where `sampleRun` is one legal, plain record
   (not built with the recorder) that shows what the rules accept. Make it with a bot: a test helper (`test/support/bot.ts` in the
   finished games) plays a seed with a simple strategy through the session, a throwaway test prints the record's inputs, and you
   paste them in as literals. Check that the sample earns exactly the milestones its `claims` list names. A test that a careful bot
   reaches the hardest milestones (`test/fairness.unit.test.ts` in the finished games) proves the goals can be met by a legal run.
3. The SDK's build emits `verifier.js` and `verifier.json` beside the game. In the manifest add the `run:submit` capability,
   `verification: { replay: { id, sha256, version } }` with the digest from `verifier.json`, and `verification: "replay-verified"`
   on each milestone the rules decide. The test that pins it is `apps/web/test/games-verifiers.unit.test.ts` (run it from
   `apps/web` with `npx vitest run --project unit test/games-verifiers.unit.test.ts`): while the manifest's digest is a placeholder or
   out of date it fails and prints `pin <digest>`. **Pin last.** A change to anything the verifier bundles (the rules, the constants,
   the sample) changes the digest, so every time you touch the rules, run it again and re-pin.
4. In the page: `play.runs.start()` for a seed (signed-in players get one; others get `unavailable` and play on a seed of their own,
   self-reported), record the run, `play.runs.submit(runId, record)` at the end. The answer is `verified`, `rejected` or `refused`.

The page then shows the milestone as "Replay-checked". That shows the run followed the rules; it does not show a person played it.

## Scores and the leaderboard

A game gets a leaderboard when it declares `verification` in its manifest. **There is no way for a game, a page or an agent to send a
score.** The platform never takes a score from a page: it takes the run record, replays it with the game's published rules, and reads
the score from the replayed state. The board ranks each signed-in player's best such score for all time, the month and the week. A game
that sends nothing it can replay has no board, and a game whose rules report no score has a board that never fills.

So "sending a score" means three things, all of them needed:

1. **The rules report it.** Add `score(state)` to the `GameVerifier` (`<sdk>/run-record`): `score: (state) => (state.ended ? state.score : null)`.
   Return a whole number from 0 up, and only once the run has ended (`null` before that and for a game that keeps no score). Anything
   else is read as none. The scaffold from `pnpm game:new` already has it; a game written by hand, or an older one, may not.
2. **The page records the run and submits it once at the end**, as in step 4 above (`play.runs.start()`, record, `play.runs.submit()`).
   A player who is not signed in gets no run and so no ranked score. A test or practice run must submit nothing.
3. **The published digest matches.** `score` is part of the rules, so adding or changing it changes the verifier's digest: raise
   `verifierVersion`, rebuild, and re-pin `verification.replay` (`sha256` and `version`) in the manifest. A run recorded under the older
   version is not replayed under the newer one.

Rules for what the score is:

- It must be **the number the game shows and keeps as the player's best.** Give the rules and the screen one function for it, and
  prove they agree with `expectVerifiedScore(rules, sampleRun(), shownScore)` from `@frostbite/test-kit/verified-score` (see
  `games/tower-stack/test/verified-score.unit.test.ts`). It also checks that a run that has not ended has none.
- **One scale per game.** The board compares every score on it, so a game with several modes or levels must give a score only to the
  mode that ranks, and `null` to the others. (Pocket Dragon scores the whole quest and none of its single levels, which are worth less.)
- It must follow from the inputs alone: the same record always replays to the same score. No clock, no `Math.random`, no I/O.
- Higher is better. A game where less is better (a time) must report a number that grows with how well the player did.

## Making milestones claimable on chain

Declare `rewards: { templateId, templateVersion }` naming the contract template the platform offers (today `game-rewards` at `1.0.0`).
Every milestone is then enabled in that contract and the most times one address can claim it is the milestone's own policy. The
player's own wallet signs and pays the fee. Holding a token means "claimed", never "earned". Check with the platform's operators
which networks are live before promising a player a claim.

## Determinism checklist

- The same seed and inputs give the same run on every machine. Use the seeded generator; no `Date.now`, no `Math.random`, no
  floating-point that differs between engines (prefer integers, with a fixed-point scale).
- Count time in ticks. The screen's timer only drives `step`; it never decides what happens.
- Test that two runs with the same seed and inputs end identically, and that a different seed makes a different level.
- Test that the sample run replays and earns exactly the milestones you claim it earns.
