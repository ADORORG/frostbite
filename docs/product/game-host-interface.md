# Game host interface and milestone claims (Amendment 1 to ADR-018)

Status: **accepted by the product owner on 2026-10-12 as Amendment 1 to ADR-018** (`docs/decisions/`). Section 8
says what is built and where the build differs from the answers below; the choice screen for differing saves is
deferred, newest-wins stays. Product direction (2026-10-12), recorded here before anything is built:

- Every game is **client-only**: a static bundle built from reviewed source, no server of its own.
- Games run on the platform's domain, in an **isolated frame**, and talk to the platform through one **clean
  interface**. The same flow serves every game.
- **Progress and milestones are saved by the platform** in the browser (localStorage) for a player who is not
  signed in, and to the account when they sign in or connect a wallet.
- A player with a wallet connected can **mint** their milestones whenever they want.
- **Milestones are real, not cosmetic.** Claims are self-reported at first; verification is added later without
  a migration. Nothing with money or privilege attaches to a self-reported milestone.

This replaces the part of ADR-018 that had each game's server vouch for a milestone (the attestation service,
GP-06): a client-only game has no server. The wallet, mint pipeline, `game-rewards` contract and the states
earned, claim pending, claimed and complete stay.

## 1. How a game runs

- A CI build produces the game's static files from the reviewed pull request. No binary is committed.
- The platform serves them under its own domain (for example `/play/<id>/`) with response headers that give
  the page an empty identity: CSP `sandbox allow-scripts` (no `allow-same-origin`), `connect-src 'none'`,
  `form-action 'none'`, `frame-src 'none'`, `base-uri 'none'`, `script-src 'self'` and `style-src 'self'`.
  The browser then gives the game no access to the platform's cookies, storage or API, and no network at all.
- The game page on the platform shows it in an `<iframe sandbox="allow-scripts">` with a new-tab-free design.
  The platform page, not the game, owns everything persistent.
- Consequences for a game: no `fetch`, no storage of its own, no CDN scripts or fonts (everything is bundled),
  no in-browser compilation (precompiled). The legacy FROST·BITE needs a build step that does this (GP-09).

## 2. The interface (what a game may call)

A small versioned protocol over `postMessage`, wrapped by a `@ador/game-sdk` package so a game just calls
functions. Every message carries protocol version, request id and a payload validated on both sides; the host
accepts messages only from the game's own frame.

| Call                    | What it does                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `ready({ version })`    | The game has loaded; the host answers with the player's state and what it supports.    |
| `progress.load()`       | Returns the game's saved state (a JSON value) or nothing.                              |
| `progress.save(state)`  | Saves it. Size-limited (typed policy), versioned, validated as JSON.                   |
| `milestones.list()`     | The milestones the game declared (from its manifest) with the player's status of each. |
| `milestones.unlock(id)` | The player earned it. Idempotent; only declared ids; counted against limits.           |
| `player.info()`         | Signed in or not, wallet connected or not (a yes or no), never the wallet itself.      |

The host never forwards cookies, wallet objects, addresses or raw transactions to the game. A call the game
does not declare in its manifest is refused. A game that breaks the protocol is stopped and the player told.

## 3. Where progress and milestones live

- **Not signed in:** the platform page stores them in localStorage under a key for the game (and one local
  player). The game never sees the storage.
- **Signing in or connecting a wallet:** the platform uploads local progress and milestones to the account and
  merges with what the account already has: per milestone the earliest unlock wins; progress takes the newer save
  by its own timestamp unless the player picks (a small, explicit choice screen). Nothing is lost silently.
- **Server record** (new tables, owned by a games feature): per account and game, a progress blob (size limit),
  a version, and the set of milestones with `unlockedAt`, `verification` and claim state.

## 4. Milestones are real and honestly labelled

- A claim has a **verification level**: `self-reported` today. Later levels (for example `replay-verified`: the
  game is deterministic and the platform re-checks a recorded run on its own server) are added, not retrofitted.
- The mint records the level. On-chain the token (or its record) says `self-reported`; a verified token is
  distinguishable forever. The product says "claimed by the player" for self-reported milestones, never
  "verified".
- **Guardrail:** nothing that carries money or a privilege (rewards, access, ranking prizes) may depend on a
  self-reported milestone. When such a thing is wanted, the milestone must first have a verified level.
- Per-game and per-account limits and rate limits apply to unlocks and claims.
- Tokens start non-transferable (as in ADR-018); releasing that is a separate decision.

## 5. States the player sees

earned (unlocked in the game) -> claim pending (signed or broadcast) -> claimed (confirmed) -> complete (indexed
state agrees). "Minted" is never shown before the indexed state agrees. Earned status comes from the platform's
records, never from token ownership.

## 6. Build order

1. `@ador/game-sdk` and the host: frame with the headers above, the protocol, a conformance test with a
   simulated game (this is GP-02/GP-03, now simpler); the game page plays a game through it.
2. Local save and load; the progress limits.
3. Account records and sync on sign-in, with the merge rules.
4. Milestone list and unlock; declared milestones in manifests (already declarable).
5. Migrate FROST·BITE to a precompiled, self-contained bundle on the SDK (GP-09).
6. Minting: the `game-rewards` contract with the verification level, the `mint-milestone` intent through the
   quote, sign, broadcast, observe pipeline (needs the mint pipeline, W6/W7, and the gated decisions).

## 7. Product owner answers (2026-10-12) and what is still open

Answered:

- **Which wallet mints:** whichever wallet is connected at that moment; the platform records which wallet claimed
  each milestone.
- **Progress merge:** milestones are always combined (earliest unlock wins); the main progress takes the newer
  save, and the player is asked when the two differ a lot.
- **Saved progress size:** 64 KB per game per player, as typed configuration (changeable without a release).
- **First verified level:** explore replaying a recorded run on the platform's server (the game must be
  deterministic). Self-reported stays until then.

Answered in a second round:

- **Milestones per game:** up to 64 (typed policy, configurable).
- **"Differ a lot" for the merge:** the two saves disagree on any milestone, or the older save has more progress
  by the game's own measure; otherwise the newer save wins quietly.
- **Frame permissions:** full-screen, audio and keyboard or gamepad input, and nothing else (no camera,
  microphone, location or file access).
- **Build first:** the SDK, the isolated frame and a simulated test game, before touching FROST·BITE.

Still open:

- The shape of a deterministic run record for replay verification (a spike with the first game).

## 8. What is built (2026-10-12) and where it differs

Built and tested (steps 1 to 4 of section 6): the SDK and protocol, the isolated frame and its headers, the
simulated and real-browser tests, local saving, account saving and sync, milestone list and unlock, the 64 KB
limit and call rates. Not built: the registration generator, milestone states beyond "reached", FROST·BITE on the
SDK, the run-record spike, and minting (steps 5 and 6).

Differences the owner should confirm or change (the merge rule is one function, `mergeGameState`):

- **Progress merge:** built as "the newest save wins, every milestone from either side is kept with its earliest
  time". The answer in section 7 also asked for a choice screen when the two saves "differ a lot"; that screen
  is **not built**, so today the older save is replaced silently on the account. Needs a game-defined measure of
  progress, so it is deferred until a real game defines one.
- **Wrong clocks:** a save dated more than five minutes ahead of the server is ignored, so a device with a wrong
  clock keeps its local save but does not reach the account until its clock is right.
- **Idempotency:** the sync takes no key because replaying it changes nothing.
