# G7: minting a milestone (task #42; GP-05, GP-07)

Status: **G7a to G7d built** (the manifest declaration; the intent, claim records and claim service on the simulated chain; the SDK method, the host handler and the HTTP routes; the player's review and states); G7e-1 to G7e-5 built (the contract templates; the adapter's reads; its milestone-claim path; the drawing sanitiser; the staff's administration steps, signed by hand with a one-time key for witness data). G7f adds the staff page (`/admin/games`, `@ador/feature-game-admin` over `@ador/game-admin`), run on the simulated chain; the wallet-side signing of a bundle is not built. Written 2026-10-16 after ADR-018 Amendments 1 and 2.
Specification it builds on: ADR-018 (`docs/decisions/`), `docs/product/game-host-interface.md`, ADR-017 (neutral chain ports).

## 1. What G7 is now

A player who has earned a milestone in a game asks the platform to mint it. The platform builds the transaction, shows the
player what it does, the player's wallet signs it, the platform broadcasts it and watches until the chain agrees. Nothing else
in the game changes: a builder declares milestones in the manifest and calls `milestones.unlock`, as today.

Two amendments simplify the original ADR-018 design a great deal:

- **No attestation.** Amendment 1 removed the game-server attestation (GP-06); Amendment 2 allows a self-reported milestone to
  mint. So the contract takes no signature, the Schnorr-in-the-Alkanes-runtime spike (GP-00) is moot, and there is no attestor
  key, nonce store or per-game credential to build.
- **The contract is small.** `game-rewards@1` is: initialise (the enabled milestones, each with its claim policy and the claim
  limit), `claim(milestone)` for the caller, pause and resume, a transfer lock that starts locked, and views. It holds no funds.
  The limit is a deploy-time setting taken from the manifest's `claimPolicy`, not a constant in the code.

## 2. The honest limit (to be said in the product)

The contract cannot know whether a milestone was earned. Anyone can call it directly for any enabled milestone, up to the
per-address limit, without playing. So **holding the token means "claimed", never "earned"**: the page shows "earned" from the
platform's own record (with its level, "Reported by the game" or "Replay-checked") and "claimed" from the chain, and the
copy never says "minted" before the indexed state agrees. A person with several wallets can claim once per wallet; the limit is
per address, not per person. Both are accepted under Amendment 2 and need saying plainly in the catalog.

## 3. The flow

1. The player earns a milestone; it is on their account as before (`game_milestone_unlocks`, with its level).
2. In the dock's milestone list, a claimable milestone offers **Claim**. A game may also ask: new SDK method
   `milestones.claim(id)` under a new capability `milestone:claim` (ADR-018 section 5). The game never sees a wallet object, a
   signing request or a transaction; it gets back `requested` and, later, state events.
3. The platform checks: the game declared the capability and a rewards contract; the milestone is declared and earned on this
   account; no claim is already live for it; the player's wallet is connected and on the right chain.
4. A new intent, `mint-milestone` (chain, sender, contract, milestone id), joins the neutral `TransactionIntent` union
   (`deploy`, `mint`, `transfer` today). It goes through the existing ports: quote and simulate, build, show the neutral summary
   (operation, milestone, recipient, **network fee**, expiry), wallet signs, `verifySigned`, broadcast, observe, reconcile.
5. A persisted **claim** record per (account, game, milestone, attempt) holds the transaction reference and state. States are
   exactly the neutral lifecycle (`constructed` ... `complete`), shown to the player as **earned**, **claim pending**,
   **claimed**, **complete**, with failure and "could not confirm" kept separate. Re-submitting is idempotent; a broadcast of
   unknown outcome resolves only by looking the transaction up.

## 4. Where it can start, and what blocks it

The real chain work is **not buildable yet**, and the reason is the ledger, not this design:

| Needs                                                       | State                                                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Contract template pipeline (W6-01 to W6-06)                 | Blocked on W6-00 (D19, administration and freeze) and W5-00                         |
| Quote, build, sign, broadcast, observe on `bitcoin-alkanes` | Blocked on W7-00 (D22, confirmation policy); the adapter has only the address codec |
| A wallet that can sign a transaction                        | Signing is qualification-only (wallet audit; roadmap SDK-6)                         |

What does **not** depend on those, because the platform already has a simulated chain (`@ador/test-kit/simulated-chain`) and a
chain-neutral port set:

- **G7a Manifest declaration** (GP-01): a game declares its rewards contract role and version, and the `milestone:claim`
  capability; validated, with the claim limit taken from each milestone's `claimPolicy`.
- **G7b Intent and claim record**: `mint-milestone` in the neutral union (and in the chain-operation policy, which fails the type
  check until both agree), the `game_milestone_claims` table, the claim service (idempotent, states persisted), tested on the
  simulated chain end to end, including duplicate, rejection, expiry and lag.
- **G7c Protocol and host**: `milestones.claim` and its state events in the SDK protocol; the host handler behind a port; the
  capability check.
- **G7d Player states** (GP-08): the dock and game page show earned, claim pending, claimed, complete, with the fee note and
  the level label, against the simulated chain; Playwright for success and each failure.
- **G7e The contract** (GP-05), in four pieces: **G7e-1** the `game-rewards@1` and `milestone-collectible@1` templates in
  `contracts/templates` (built, below); **G7e-2** the `bitcoin-alkanes` adapter's reads (`rewards.claimed`, the collectible's
  picture and content type, contract inspection); **G7e-3** its claim build, broadcast and observe, and the claim simulation ; **G7e-4** the off-chain
  SVG sanitiser for builder drawings; **G7e-5** the staff's steps (publish a template, create a game, define a milestone with its
  drawing, pause and resume), proven on the real indexer. No platform key exists: staff sign each step after reading its summary.

**G7e-1 built.** `contracts/templates` holds one `game-rewards` instance per game and one shared `milestone-collectible` template
(ADR-018 Amendment 3): a wallet claims a milestone up to a per-milestone limit and receives its own numbered collectible, whose picture is
the builder's drawing in a generated frame, or a generated sprite when the milestone has none; the platform holds the auth token that
defines milestones and pauses. See `contracts/templates/README.md` for the layout, the ABI, the known limits and the chain-neutral
mapping the adapter implements.

**Built so far.** G7a: `rewards` and `milestone:claim` in the manifest (`@ador/shared/games`). G7b: the `mint-milestone`
intent and summary in `@ador/shared/chain`; a `rewards` reader port (`RewardsReader.claimed`, capability `rewards:read`) in
`@ador/chain`, which tells that a claim the platform watched confirm has also been indexed; the simulated chain executes claims
(and can revert one); the `game_milestone_claims` table; and `@ador/game-claims` (start, submit signed, refresh, list). Notes: a
claim is `complete` only once the reader shows the wallet's expected count; a failed claim stops at the state that saw the failure
(no reconcile step for a claim that never happened); the platform's claim limit is per account while the chain's is per address.
**G7c.** `milestones.claim` and the `claim.changed` event in the SDK protocol (capability `milestone:claim`, rate limited, the
milestone must be declared); four POST routes (`/api/v1/games/claims/start|submit|refresh|list`; this API's GET has no query
string) over `@ador/game-claims`; the page's claims port; `configs/game-claims.ts`. **Nothing is configured**: no contract is
deployed and no chain adapter takes claims, so every claim is answered `not-supported`, and the page's port answers the same
until G7d gives it somewhere to show the claim to the player. The start route takes the wallet address as text and the platform
parses it for the game's chain (an address from another chain is `wrong-network`).

**G7d.** The player's side, for a game that declares `rewards`: a **Claim** button on each earned milestone, a **review** over the
game (what the claim does, the contract, where it goes, the network fee, how long it is valid, and that the player pays the fee),
a **Claims** section in the dock listing the player's claims, and a poll of every claim that is not over. States read: waiting for
your wallet; sent; confirmed ("not complete until the network's records show it"); claimed (complete only once the chain's
indexed state agrees); failed; expired. The game is told each change (`claim.changed`). The page uses the player's connected wallet
for claiming without telling a game that did not declare `wallet`. **Signing**: the wallet signs through an injected signer, and
none exists yet (signing is qualification-only), so the review says "your wallet cannot sign claims in this version yet" and
offers no signature; the real signer is G7e. Everything is tested with a test signer against the routes.

**G7f.** Staff administration: the `game_admin_steps` log (who built and who sent each step), the `@ador/game-admin` service, and the pages and routes that drive it (`features/game-admin`), under the `game:administer` capability the `staff` role holds. Decisions: any staff member may pause and resume, logged; a complete step needs the network's records to show it (1 confirmation on signet); the decided "delayed" display (indexer more than 2 blocks behind, or 60 minutes unconfirmed, shown as delayed and never as failed) is **not built yet**, for players or staff; a milestone is defined once. No chain or contract is configured yet (`configs/game-rewards.ts`), so the pages say a step cannot be built. Staff paste a signed transaction until a wallet that signs steps is qualified.

G7a to G7d are safe to build now and are real: when G7e lands they swap the simulated chain for the real one at the ports. They
also let the owner see the whole experience before a contract exists. Each is its own branch and task.

## 5. Decisions taken on the documented defaults (review at merge)

1. No attestation, no per-game keys, no signature spike (Amendments 1 and 2).
2. The claim limit comes from the manifest's `claimPolicy` and is enforced on chain; there is no platform-wide cap.
3. A claim is by the connected wallet's address, the signer of the transaction; the contract never trusts a stated player.
4. Tokens start transfer-locked (ADR-018). "Earned" is never read from token ownership.
5. The platform pays nothing: the player pays the network fee, shown before signing.
6. Replay-verified milestones are not treated differently by the contract; the level is recorded and shown, and a later,
   separate decision could give it a better reward.

## 6. Needs the owner

- **D19** (who can pause, rotate or freeze a game's contract) and **D22** (what "confirmed" and "complete" mean: how many
  blocks, what happens on lag or a reorg). Both block G7e, not G7a to G7d.
- **Go-ahead to build G7a to G7d on the simulated chain** before those are answered. My recommendation is yes.
- Who deploys a game's rewards contract and when (at game registration, by staff?). Default if unanswered: staff, at
  registration, from the manifest, through the W6 pipeline.

## 7. Risks

- A claim is a real transaction with a fee; the copy and the state machine must never imply a mint that has not been indexed.
- Nothing stops a player claiming without playing (section 2). If rewards ever carry value this must be revisited
  (ADR-018 Amendment 2 review trigger).
- G7a to G7d on a simulated chain can pass while the real adapter disagrees on a detail (fees, confirmation); the conformance
  suite for the chain ports (`@ador/test-kit/chain-conformance`) is the guard and must run against the real adapter in G7e.

## 8. Out of scope

Transferable tokens and marketplaces (a separate ADR), a platform-wide cap, per-person rather than per-address limits,
attestation of any kind, minting from a game that is not registered.
