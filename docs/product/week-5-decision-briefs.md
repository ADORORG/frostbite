# Week 5 decision briefs: D13, D14, D17, D18

Status: preparation (W5-00). Documents only. Nothing here is accepted, and no recommendation satisfies
the Week 5 entry gate (`docs/milestones/launchpad-beta.md`; plan section on Phase 3): each decision needs a
complete record, a named owner, a date, a linked accepted ADR and the technical evidence listed below.
The decision records themselves live in `docs/decisions/DECISION_PACK.md` (outside this repository); each
brief ends with the record as it could be filled in, with every field the owner must still supply left blank.

How to read the tags: **Built** is what the code already does. **Input** is something the product owner has
said. **Open** needs an owner decision. **Evidence** is what must exist before the record can be accepted.
Where a chain mechanism is not yet proven, this document says so rather than assuming it.

## Owner answers (2026-10-11 survey)

These are inputs to the records below, not acceptance: each decision still needs the owner's name, a date, an
ADR and its evidence.

| Decision                     | Answer                                                                                                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D14 content                  | **Generated art is in the beta**, alongside uploaded images ("both"). It must be built as a clean, maintainable adapter pattern: see `docs/product/generated-art-brief.md`. This replaces the recommendation of fixed items only.                   |
| D14 reveal                   | Hidden until a reveal date (delayed reveal). Needs a commit-and-reveal design (below).                                                                                                                                                              |
| D14 maximum beta supply      | 1,000 items per collection, configurable (the engineering limit stays 10,000).                                                                                                                                                                      |
| D13 publication              | Depends on the chain family. Alkanes: the art goes on the chain itself, very small, including art composed from a light HTML/script. EVM chains: files in our storage, Arweave or IPFS. One strategy per chain family behind `PublicationStrategy`. |
| D13 authorizer and fee payer | The creator, from their own wallet.                                                                                                                                                                                                                 |
| D13 failure                  | Stop, show exactly what was and was not published, retry safely and idempotently.                                                                                                                                                                   |
| D17 payment                  | Each chain's native coin **and** a selected token on each chain. The allowed list is configuration, one entry per asset, each needing its own tests.                                                                                                |
| D17 overpayment              | Refused; exact price only.                                                                                                                                                                                                                          |
| D18 platform fee             | 2.5% (250 basis points) of the primary sale; a starting value, changeable by versioned policy.                                                                                                                                                      |
| D18 royalties                | Recorded, not enforced, shown as such; maximum 10% (1,000 basis points).                                                                                                                                                                            |

Values still to be supplied are **configuration, not code** (owner direction, 2026-10-11). Each is a typed,
versioned or environment-validated setting that the application reads at startup and refuses to start without;
none is a constant in source, and changing one never needs a release of product code:

| Value                                                                     | Where it lives                                                                              | Notes                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Platform fee (250 bps), royalty maximum (1,000 bps)                       | Versioned fee policy record; a launch version stores the policy version it was made under   | Changing policy never changes a locked launch          |
| Platform recipient address                                                | Per-environment validated configuration, one validated address per chain                    | Never free text; change needs step-up confirmation     |
| Allowed payment assets, selected token per chain, minimum price per asset | Payment-asset configuration, one entry per asset (chain, asset id, decimals, minimum price) | An entry is only enabled after its contract tests pass |
| Byte limits for on-chain and stored art, per chain family                 | Publication configuration, set from the D13 spike's measurements                            | Refused over the limit, with a clear message           |
| Maximum items per collection (1,000)                                      | Collection policy, below the engineering limit of 10,000                                    | Product quota, not a schema limit                      |
| Refused-original retention (30 days) and legal-hold rule                  | Typed upload retention policy                                                               | See the approval briefs                                |
| Reveal timing                                                             | Per-launch setting within the allowed reveal modes                                          | Mechanism still to be designed                         |

So these are no longer blockers for building: engineering builds the configuration shape and its validation now,
and the owner fills values per environment. A decision still needs its record accepted (name, date, ADR,
evidence) before the gated behaviour ships. The reveal design, the token for each chain and the owner names
remain to be decided.

Consequences worth seeing now:

- **Reveal plus on-chain art.** Delayed reveal means the art must not be public before the reveal. For art
  written on chain that is a contradiction unless the written content is committed (hash) first and revealed
  later, or the reveal happens by publishing at reveal time. The reveal design must pick one before D13 can be
  accepted for Alkanes.
- **Generated art is untrusted code.** It is reviewed as code, rendered in a sandbox, and size-limited. That is
  the largest addition to the beta; see the generated-art brief for the pattern and the scope risk.

## Order and dependencies

D14 (what a collection's content is) constrains D13 (how that content is published), which constrains D17
and D18 (what a buyer pays and who receives it). Decide in that order. The launch model that uses all four
is `docs/product/launch-brief.md`.

---

## D14: Collection content

**Question.** Is a collection's content generated by code, a fixed list of uploaded items, or both?

**Built.** The studio is a fixed-items flow: a collection has an item list (name, description, one image,
traits as name/value pairs), images are validated and processed uploads with a SHA-256 of their bytes, items
can be added one at a time, in bulk from a file, or by file import, and a submission freezes the whole list
with a payload hash. Nothing in the studio generates content. Engineering limits: up to 10,000 items per
collection, planned supply up to 1,000,000, 32 traits per item, name 120 characters, description 1,000.

**Options.**

1. Fixed uploaded items only (recommended). Matches everything built; every item is a reviewed image and a
   reviewed trait list, so what is reviewed is exactly what is sold.
2. Generated only. A generator produces each item at mint. Needs a different studio (generator upload and
   review), different publication (D13) and a deterministic-reproduction test suite. Not built.
3. Both. Doubles the review and publication surface. Not recommended for beta.

**Recommendation.** Option 1 for the beta template; generated content later as a separate template.

**Reveal.** Open: `immediate` (item visible once minted or before), `delayed` (hidden until a reveal), or
`none`. Delayed reveal needs a commit-and-reveal design and new states; recommend `immediate` for beta (the
public collection page already shows approved items).

**Maximum beta supply.** Open. 10,000 is the current engineering limit per collection, not a product quota;
the owner should set the beta maximum, at or below it.

**Metadata schema.** Built: `name`, `description`, `image` (an asset), `attributes: [{trait, value}]`,
position; import also reads NFT-style `trait_type`. Open: whether any further standard fields (external link,
edition number) are required.

**Evidence needed.** The owner's choice; the schema fixed as a versioned contract; a sample of the largest
allowed collection exercised end to end (studio, submission, snapshot size).

**Record as it could be filled in** (blank = owner must supply):

```yaml
status: proposed
decision: "fixed-items"
reason: "Matches the built studio; reviewed images and traits are exactly what is sold"
owner: ""
date: ""
metadata_schema: "name, description, image asset, attributes[{trait,value}], position; versioned"
reveal: "immediate (recommended; owner to confirm)"
maximum_beta_supply: ""
follow_up: ["generated-content template after beta"]
```

---

## D13: Art publication

**Question.** How does the creator's art become permanent and verifiable, and who pays and authorizes?

**Built.** Originals are private draft objects; validated derivatives are content-addressed and write-once.
Each processed asset has a SHA-256 of the original bytes. The plan reserves a `PublicationStrategy` port and
a "publication job" with an exact cost and content hash shown before it runs (plan 8.3). No publication
strategy exists in code, and no chain mechanism has been qualified.

**Options.**

1. Immutable content-addressed originals in managed storage, with the collection's manifest hash committed
   on chain (recommended to evaluate first). Cheapest on chain; permanence depends on the storage provider
   plus any pinning, so the guarantee is "tamper-evident", not "stored on chain".
2. Inscribed originals (bytes on chain). Strongest permanence; cost and size limits per item must be
   measured on the target chain before any promise; likely the most expensive.
3. Fully on-chain generated content. Depends on D14 option 2; out of scope for fixed items.
4. A template-selectable mix (the plan's direction). Only after one strategy is proven.

**Recommendation.** Choose exactly one strategy for the beta behind `PublicationStrategy`, evaluated on the
target chain with a spike. This brief does not recommend a specific on-chain mechanism, because none has been
tested here; the spike below decides it.

**Open owner choices.** The strategy; the authorizer (`creator wallet`, `platform`, `other`) and fee payer;
the failure or refund policy when publication fails partway.

**Evidence needed (spike).** On the signet/regtest target: publish a real item set of the maximum beta size
and record the cost per item and total, failure at each step (partial publication), retry idempotence, the
recoverable states, and independent verification that a third party can reproduce the hash from the public
bytes. The result is an ADR, not a feature flag.

**Record as it could be filled in:**

```yaml
status: unresolved
decision: ""
reason: ""
owner: ""
date: ""
canonical_bytes: "original uploaded bytes after validation (proposed)"
hash: "SHA-256"
destination: ""
authorizer: ""
fee_payer: ""
failure_or_refund_policy: ""
follow_up: ["publication spike on the target chain with measured cost"]
```

---

## D17: Initial payment asset

**Question.** What can buyers pay with in the first launches, and how are price, overpayment and failed
mints handled?

**Input (2026-10-11).** The creator picks the payment asset per launch from a short allowed list kept in
configuration. **Open:** which assets are on that list. The plan says BTC or frBTC first, and only after
the contract tests prove construction and failure behavior; every asset added needs its own tests.

**Built.** Nothing. Prices are not stored anywhere yet (they belong to launches).

**Proposals for the owner to confirm, each needing evidence.**

- Price is an integer in the asset's smallest unit stored with the asset identity; never a float.
- A minimum price per asset, set in versioned configuration (dust and fee floors), so a launch cannot set a
  price the chain cannot carry.
- Exact payment required: the contract refuses under- and over-payment rather than keeping change (a
  simple rule a buyer can verify in the quote). Open: whether overpayment should instead be refunded.
- A failed mint is all-or-nothing: no item without payment and no payment without an item; state after a
  failure is shown honestly (no "success" before indexed completion).
- Recipient: one creator recipient per launch, a validated address on the launch's chain, changeable only
  before the version is locked and with step-up confirmation (see D18).

**Evidence needed.** For each listed asset on the target chain: a constructed mint transaction, a
simulation, success, underpayment, overpayment, replay, and broken-in-the-middle failures, with the observed
fees; and the allowed list as validated configuration that fails startup when it is inconsistent.

**Record as it could be filled in:**

```yaml
status: proposed
decision: "creator picks the asset per launch from a configured allowed list"
reason: "Product owner input 2026-10-11"
owner: ""
date: ""
asset_id: "[list to be named by the owner; each needs contract tests]"
price_units: "integer, smallest unit of the chosen asset"
minimum_price: ""
recipient_policy: "one creator recipient per launch; set before lock; step-up to change"
overpayment_policy: "proposed: refused; owner to confirm"
failed_mint_policy: "proposed: all-or-nothing; no success shown before indexed completion"
follow_up: ["contract tests per listed asset"]
```

---

## D18: Fees, proceeds and royalties

**Question.** What is taken from a sale, who receives the rest, and are royalties enforced?

**Input (2026-10-11).** One fixed platform fee set by the platform; the creator sets their royalty up to a
platform maximum. Both are a versioned policy, shown in full to buyers before signing and to the creator
before deployment. **Open:** the platform fee value, the platform recipient, the royalty maximum.

**Built.** Nothing.

**Proposals for the owner to confirm.**

- Fee and royalty in basis points (an integer out of 10,000), in a versioned policy record with a start
  date; a launch version stores the policy version it was created under, so changing policy never changes a
  locked launch.
- Primary-sale split: platform fee = floor(price x fee_bps / 10,000); the remainder goes to the creator
  recipient; all rounding remainders go to the creator (a stated rule, tested at the extremes).
- Royalties: the plan's choices are `metadata-only`, `enforced` or `deferred`. Enforcing royalties on
  secondary sales is a marketplace concern the plan defers (D29); recommend `metadata-only` for beta, stated
  plainly in the UI as "recorded, not enforced".
- One creator recipient; multi-party splits deferred.
- Recipient change: only before lock, with step-up confirmation; never on a locked or live launch.

**Evidence needed.** The three open values; a property test that for any price and any bps the parts add up
to the price exactly and never go negative; the full split shown in the quote and the studio review; the
contract enforcing the split (not only the UI).

**Record as it could be filled in:**

```yaml
status: proposed
decision: "fixed platform fee; creator royalty up to a platform maximum"
reason: "Product owner input 2026-10-11"
owner: ""
date: ""
platform_fee_bps: ""
platform_recipient: ""
creator_proceeds_bps: "10000 - platform_fee_bps (after rounding rule)"
creator_recipient_rule: "one validated address per launch, set before lock"
royalties: "metadata-only (proposed; owner to confirm); maximum bps to be named"
recipient_change_policy: "before lock only, with step-up confirmation"
rounding_policy: "platform fee rounds down; remainder to creator"
follow_up: ["property test of the split", "contract-enforced split"]
```

---

## What the owner needs to provide

| Item                                                                          | Decision |
| ----------------------------------------------------------------------------- | -------- |
| Reveal mode and the beta maximum supply                                       | D14      |
| Extra metadata fields, if any                                                 | D14      |
| Publication strategy, authorizer, fee payer, failure policy (after the spike) | D13      |
| Allowed payment assets; minimum price; overpayment policy                     | D17      |
| Platform fee value and recipient; royalty maximum; royalties mode             | D18      |
| Owner name and date on each record, and approval to promote each to an ADR    | all      |

## What engineering can do before the decisions are accepted

Only reversible, ungated work: the D13 spike on the target chain (cost and failure measurements, no product
code), the split property tests as a library, and the launch-record work that does not encode a gated value.
Nothing may ship behind a flag or a default in place of an accepted decision.
