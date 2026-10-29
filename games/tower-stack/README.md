# Tower Stacker

A tap-to-drop stacker for the platform's arcade. A block of ice slides to and fro over a tower; tap the screen (or press space) to drop it.
What hangs over the tower is cut off, so the tower narrows unless every drop is clean. Land two perfect drops in a row and each further
one grows the block back. The block goes faster the higher you build. It is client-only: no server, no network, nothing stored by the
game itself (the platform keeps progress and milestones).

## Layout

```
src/rules/     the rules, as a pure seeded state machine (a GameVerifier): constants, types, block (the sweep), drop, state, milestones, index
src/session.ts one run as a player plays it: ticks, drops, the blocks set down and the run record the drops make
src/screen/    drawing (backdrop, tower), the view that rises with the tower, the 30-a-second clock, and the keys and touches
src/main.ts    joins the page to the platform (progress, milestones, runs)
src/replay.ts  the verifier the platform replays runs with (rules + one sample run)
```

## How runs are checked

The rules know only ticks (thirty a second) and whole numbers; the same seed and drops always play out the same way. Nothing moves
between drops that the rules have to simulate: where the block is on any tick is a triangle wave of its speed, where it began (drawn from
the seeded generator) and the tick it appeared on. The platform gives a run its seed, the game records only the drops (`drop` and `end`,
each with the tick it was made on), and on `run.submit` the platform replays the record with the published verifier. A milestone the
replay earns is held as replay-verified, which shows the run followed the rules, not that a person played it. The verifier's SHA-256 is
pinned in `configs/games/tower-stack.ts`; changing the rules changes the digest, and a test fails until the pin and `verifierVersion`
are updated together.

## Milestones

20, all decided by the state of a run alone (`src/rules/milestones.ts`): heights (1 to 200 blocks), perfect drops (1, 10, 50), streaks of
perfect drops (3 to 20), two separate streaks of five, winning width back, a needle of a tower, a wide load, a tidy tower, a drop that
only just lands, and still stacking after three minutes. The words are in the manifest. The list is a draft for the owner to approve.

## Difficulty

`test/fairness.unit.test.ts` holds the balance. A bot that is never late stacks as long as the run lasts. A hand a few ticks out (a few
hundredths of a second) reaches 20+ blocks, and one five ticks out still gets several up; a hand that is further out falls sooner. A
perfect drop is always there to be met: the window is wider than the step of the fastest block.

## Tests

`pnpm --filter @game/tower-stack test:unit`, `test:integration` (bundles the page and runs it against a simulated platform),
`test:coverage`.

## Ownership

Platform games team.
