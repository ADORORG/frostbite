# Launch brief: pricing and phases live on the launch

Status: draft; product owner answers recorded in section 7. Documents only; no code until D13, D14, D17 and D18 are accepted
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
- `payment_asset` (D17: chosen per launch from an allowed list), `royalty_policy` (D18: fixed platform fee, creator royalty within a maximum), `proceeds_recipient` (a validated
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

## 7. Product owner answers (2026-10-11)

| #   | Question                  | Answer                                                                                                                                                                                                                                 |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D17 | Payment asset             | The creator picks per launch, from a short allowed list kept in configuration. The list itself (which assets, and each one's contract tests) is still to be named.                                                                     |
| D18 | Fees, proceeds, royalties | One fixed platform fee set by the platform; the creator sets their royalty up to a platform maximum. Both are a versioned policy record, shown to buyers in the quote, never hidden. The actual fee and maximum are still to be named. |
| New | Creator's reserve         | The creator mints it like a buyer, through the same path; it counts against total supply.                                                                                                                                              |
| New | Price after lock          | Never. A different price is a new version, reviewed again, made before the first phase starts.                                                                                                                                         |
| New | Launches per collection   | One active launch at a time during beta, enforced in the database.                                                                                                                                                                     |
| D16 | Phase timing              | Unchanged: contract block windows, estimated wall time in the UI only.                                                                                                                                                                 |

Consequence of the D17 answer: the payment asset is a field of the launch version chosen from the allowed list,
the allowed list is configuration validated at startup, and every asset on it needs its own contract tests
before it can be listed (plan D17). Price is stored with the asset it is in.

Still open before Week 5: the allowed payment assets, the platform fee value and the royalty maximum, and the
formal records (D17 and D18 decision entries and linked ADRs) that the entry gate requires. These answers are
inputs to those records, not a substitute for them.

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
