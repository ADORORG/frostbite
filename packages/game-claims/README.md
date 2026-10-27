# `@ador/game-claims`

A player's claim of a milestone from a game's rewards contract: build the transaction, keep what the wallet was shown and
signed, send it, and follow it until the chain agrees. Plan: `docs/product/plan-g7-minting.md` (task G7b). **Nothing here talks
to a real chain yet**: it works through the chain-neutral ports (`@ador/chain`) and is tested against the simulated chain
(`@ador/test-kit/simulated-chain`). The real contract and adapter are G7e.

## Public API

`createGameClaimsService(dependencies)` returns:

- `start({ userId, gameId, milestoneId, wallet })`: checks the milestone is claimable (declared, with a deployed contract, on the
  wallet's chain) and earned on the account, simulates and builds a `mint-milestone` transaction, and stores the claim as
  `awaiting_signature` with the summary to show and the transaction to sign. Asking again returns the claim in progress
  (`resumed: true`). Refuses with `not-claimable`, `unavailable`, `wrong-chain`, `not-earned`, `limit-reached`, `would-fail`
  (the contract would refuse it) or `chain-unavailable`.
- `submitSigned({ userId, claimId, signed })`: checks what the wallet signed against what was built (`verifySigned`), keeps it,
  and broadcasts it once. The same signed claim twice changes nothing; a different one is `not-awaiting-signature`.
- `refresh(userId, claimId)`: looks at the chain once and moves the claim as far as the evidence allows. Safe to call as often
  as wanted (the host's job to poll, G7c).
- `list(userId, gameId)`.
- `minted(userId)`: the player's claims in every game that the network's records show `complete` (claim, game, milestone, the time it
  was recorded complete, transaction id), the most recently completed first. Nothing in another state is listed.
- `picture(userId, claimId)`: the picture the chain serves for the item a complete claim of the player's minted (`collectible_id`, recorded
  when the network first shows the transaction included). Shown only when the item's issuer is the claim's own contract (chain, family
  and id) and its kind is one of `mintedPictureContentTypes`; otherwise `no-picture`. A chain that cannot be asked is `chain-unavailable`.

`createDrizzleGameClaimRepository(database, { clock })` stores claims in `ador.game_milestone_claims`.

## States

The neutral transaction states (ADR-017): `awaiting_signature`, `signed`, `broadcast_accepted` or `broadcast_unknown` (the network
may have it; it is looked up by its id, never sent again blindly), `pending`, `confirmed`, `complete`; `broadcast_rejected` and
`indexed_failure` (the network included it and it reverted) are failures with a reason; `expired` is a claim never signed in
time. **`complete` is reached only when the chain's indexed state shows the claim** (`RewardsReader.claimed` at least the
claim's `expectedClaims`), never on confirmation alone. A claim that failed stops at the state that saw the failure: there is
nothing to reconcile.

## Invariants

- At most one claim per player, game and milestone is in progress (a partial unique index), so two starts together make one
  claim. A claim that was never signed and has run out of time expires, and neither blocks nor counts.
- A milestone is claimed no more than its manifest policy allows: `complete` claims count against the limit from
  `rewardsInitialisation` (`@ador/shared/games`). The chain enforces its own limit per address; the platform's is per account.
- A step is written only if the lifecycle allows the move from where the claim is now (`canMove`), under the claim's row lock,
  so a step that arrives late or twice cannot move a claim backwards.
- A claim is never reachable by another player: every read and write is scoped to the player, and another's claim id answers
  `not-found`.
- Provider failures leave the claim as it was and answer `chain-unavailable`; they never move it.

## Not here

The HTTP routes, the SDK method and the host handler (G7c); the page (G7d); which contract is deployed for a game, and the real
adapter's build, broadcast and observe (G7e). The confirmation depth is the adapter's observation of the chain's policy
(D22, not yet decided); this package takes an observation of `confirmed` as given.

## Tests

`pnpm --filter @ador/game-claims test:unit` (transitions, summary codec), `test:integration` (the service end to end on the
simulated chain against real PostgreSQL: the whole lifecycle, every refusal, rejection, an unreachable network, a broadcast of
unknown outcome, a revert, indexer lag, expiry, concurrency, ownership, and the table's own constraints), `test:coverage`.

## Ownership

The games platform owner.
