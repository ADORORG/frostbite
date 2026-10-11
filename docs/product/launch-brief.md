# Launch brief: pricing and phases live on the launch

Status: draft for the product owner. Documents only; no code until D13, D14, D17 and D18 are accepted
(Week 5 entry gate, `docs/milestones/launchpad-beta.md`). Nothing here fills in a gated decision; open
choices are marked **Decide** with the options and a recommendation.

## 1. Principle (decided)

Pricing is not on the collection. A collection is what is made: identity, media, items, traits,
provenance. A **launch** is how it is sold: price, supply to sell, reserve, royalties, payment asset,
phases, allowlist, schedule. One approved collection may have several launches over time; a launch has
exactly one collection version.

## 2. What exists today (the foundation to build on)

- Approved collection versions: frozen submission snapshots with a `payloadHash`, readable with
  `findApprovedVersion` and lockable with `lockApprovedVersion` (`packages/collections`), and only while the
  creator is still approved.
- `plannedSupply` and `targetChain` on the collection snapshot; items with traits and image assets.
- Idempotent, owner-scoped, transactional mutation pattern (`editCollection`), review states, audit events.
- Chain-neutral refs (`bip122:…` text, adapter family and version recorded, never a network enum).

## 3. Launch model

Records (plan section 10): `launches`, `launch_versions`, `mint_phases`; allowlists are a separate feature
that a phase references.

**Launch** (stable identity): id, owner, `collection_id`, slug, state, created/updated.

**Launch version** (editable draft, then locked and immutable; same pattern as collection submissions):

- `collection_submission_id` + `collection_payload_hash`: the approved version being sold. Creating or
  locking a version takes `lockApprovedVersion`, so a suspended creator or a revoked collection cannot start
  or lock a launch, and a later collection edit never changes what was launched.
- `chain_id`, adapter family and version (copied from the collection; a launch cannot target another chain).
- `supply_for_sale` (at most the collection's item count / planned supply), `reserve` (items kept back for
  the creator, counted against supply), per-wallet limit default.
- `payment_asset` (**Decide D17**), `royalty_policy` (**Decide D18**), `proceeds_recipient` (a validated
  address on the launch chain, never free text, with step-up confirmation to change).
- `contract_template` and version (reviewed template only; custom contracts need a separate review).
- Locked: a hash over all of the above plus phases and the allowlist snapshot root, so the deployed contract
  can be checked against exactly what was reviewed.

**Mint phase** (belongs to a launch version): order, label, fixed `price` in the payment asset's smallest
unit (integer, never a float), `start` and `end` as contract-native block heights (D16), per-phase supply,
per-wallet limit, optional allowlist reference (D15), optional per-address price override from the
allowlist. Phases may not overlap unless explicitly allowed; windows and supply are validated for
consistency before a version can be locked.

## 4. State machine

`draft` -> `submitted` -> (`changes-requested` -> `draft`) | `approved` -> `locked` -> `deployed` ->
`scheduled` -> `live` -> `ended`; plus `paused`, `cancelled`. Review follows collection review rules
(no self-approval, concurrency-safe, audited). Deployment, scheduling, pausing and recipient changes need
step-up confirmation. Request acceptance, deployment transaction, confirmation, and indexed state are
distinct states, as for minting (plan 8.6); a launch is never shown live from request acceptance alone.

## 5. Where pricing is enforced

- Authoritative: the contract validates phase, price, allocation, prior claims and supply (plan 8.5). The
  database and API validate the same invariants earlier for clear errors; neither replaces the contract.
- Shown to collectors before signing: item price, total, estimated network fee, payment asset, recipient,
  phase and eligibility, expiry and simulation result. Fees and royalties are an explicit versioned policy,
  never hidden in UI (D18).
- Stored as integers in the payment asset's smallest unit with the asset identity beside it; display
  formatting only in the UI, from a catalog.

## 6. Studio and public surfaces

- Studio: a "Launches" area next to collections. "Create launch" starts from an approved collection (a
  picker of approved collections, never a free-form copy), then steps: sale (supply, reserve, price),
  phases, allowlist, contract and simulation, review, deploy, schedule. The collection wizard gains no price.
- Public: launch detail (status, block height countdown, price, supply, progress, eligibility), reading the
  locked version, never the draft. Collection detail links to its launches.

## 7. Decisions needed

| #       | Decision                          | Options                                              | Recommendation                                                                                                   |
| ------- | --------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| D17     | Payment asset                     | BTC only; frBTC; both per template                   | Per plan: BTC/frBTC first only after contract tests; one asset per launch, chosen from an allowed list in config |
| D18     | Fees, proceeds, royalties         | Platform fee, creator proceeds split, royalty bounds | Versioned policy record with bounds; per-launch values within bounds; shown in the quote                         |
| D16     | Phase timing                      | Block windows (accepted direction)                   | Block heights in the contract, estimated wall time in UI only                                                    |
| D13/D14 | How art and content are published | Content-addressed flow per template                  | Not part of pricing; the launch only references the approved collection version                                  |
| New     | Reserve and creator mint          | Reserve minted by creator wallet, or airdrop         | Count against supply; minted by the creator through the same contract path                                       |
| New     | Price changes after lock          | Never; or new version before start                   | Never on a locked version; a new version supersedes before the first phase starts                                |
| New     | Several launches per collection   | One at a time; or overlapping                        | One active launch per collection in beta, enforced in the database                                               |

## 8. Proposed task breakdown (after the gate)

1. Launch and launch-version records, migration, repository, state machine, audit (no UI).
2. Mint-phase model, validation (windows, supply, price integers), locked hash and immutability.
3. Studio launch creation from an approved collection; phase editor; responsive visual and a11y coverage.
4. Review and approval path; step-up confirmations.
5. Allowlist integration (D15) and eligibility.
6. Quote, simulation and public launch page.
   Each follows the repository rules: files at most 300 lines, configuration-driven values, positive and
   negative tests, mutation-proven invariants, and journey e2e.

## 9. Not in scope

Contract deployment mechanics, indexer reconciliation, marketplace, secondary royalties enforcement, and
any price on the collection or its items.
