# Game security review (G8, GP-10)

Reviewed 2026-11-10 on branch `test/g8-game-security`. Scope: what a hostile game, a hostile player or a script posing as the game's page can do through the host protocol, the frame, the HTTP routes and the claim and run services. This is a review of the code and its tests, not a penetration test, and it does not say the platform is secure: it says what was looked at, what was found, and what was not.

## Method

For each surface: read the code end to end, list what an attacker controls, and check whether a test already pins the defence. Where nothing pinned it, a test was written first and watched to fail for the right reason before any fix. Findings are verified (a failing test or an executed check), not suspected.

## Surfaces and where each defence is pinned

| Threat                                                                                               | Defence                                                                                                             | Pinned by                                                              |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Game calls a method it did not declare                                                               | capability check before any handler runs                                                                            | `host.unit.test.ts`, `host-extensions.unit.test.ts`                    |
| Game calls before `ready`, with inherited names (`constructor`, `__proto__`), or with bad parameters | `Object.hasOwn`, ready gate, schema parse                                                                           | `host.unit.test.ts`                                                    |
| Game floods saves, unlocks, claims, runs, toasts                                                     | per-kind one-minute limiter, refused calls not recorded                                                             | `host.unit.test.ts`, `host-claims`, `host-runs`, `host-wallet-connect` |
| Game saves or submits an oversized value                                                             | byte limit checked against the policy                                                                               | `host.unit.test.ts`, `host-runs.unit.test.ts`                          |
| A page other than the game's frame answers the host                                                  | messages accepted only from the frame's own window                                                                  | `attach.unit.test.ts`                                                  |
| Game reads the platform's cookies, storage or pages                                                  | `sandbox="allow-scripts"` (no `allow-same-origin`) in the markup and in the files' own CSP                          | `pages.integration.test.tsx`, `frame-headers.unit.test.ts`             |
| Game calls the network or loads outside code                                                         | `connect-src 'none'`, scripts and styles from `'self'` only                                                         | `frame-headers.unit.test.ts`                                           |
| Forged, replayed or foreign run                                                                      | seed issued by the platform, run bound to user and game, row lock, single use, expiry, digest of the rules at issue | `service.unit.test.ts`, `game-runs-flow.integration.test.ts`           |
| Claim of someone else's milestone or claim                                                           | every claim read and write is scoped to the session's user                                                          | `game-claims-flow.integration.test.ts`                                 |
| Signed transaction swapped after review                                                              | `verifySigned` against what was built and shown; re-sending the same payload is idempotent                          | `game-claims-flow`, `claims-failures`                                  |
| Staff routes reached by a player                                                                     | `kind: "platform"` access with the game-administration capability                                                   | `game-admin` `operations` and `registration` tests                     |

## Findings

### F-1 Fixed. A forged report started a claim on a milestone only a replay can prove

The sync route reads whatever a browser sends as the game's own report (`self-reported`), which is right. But the claim start asked only whether the milestone was on the account at any level. A signed-in player (or a script) could therefore sync a milestone the manifest declares `replay-verified`, and start a real on-chain claim for it with no run ever replayed.

Reproduced first: the new test `apps/web/test/game-claims-trust.integration.test.ts` returned a started claim. The claim now needs the level the milestone's manifest asks for (`features/games/src/domain/claim-eligibility.ts`, used by `claims-runtime.ts`). Milestones the manifest leaves self-reported are claimable at either level, as before. The same test also pins that a milestone becomes claimable once the platform's own replay has verified it.

### F-2 Fixed. Three claim steps that reach the chain had no limit of their own

`startGameClaim` simulates a transaction and asks the fee source; `refreshGameClaim` asks the network; `submitGameClaim` broadcasts. All three rode the shared write allowance (120 a minute per person for everything), so one account could spend about 120 chain calls a minute, and many accounts proportionally more. They now have their own buckets (10, 20 and 90 a minute; the page looks at each unsettled claim every 4 seconds) and the rate-limit record is version 3. `apps/web/test/rate-limits.unit.test.ts` pins that each has its own bucket under the shared one.

### F-3 Open, needs the owner. `TRUSTED_PROXY_HOPS=0` switches off every per-address limit

With no trusted proxy the client address is unknown, and the address checks return "allowed" (`packages/http/src/rate-limit.ts`). The production template leaves the value blank (which means 1), but nothing stops `0` in a preview or production environment, where it would silently remove the limit on sign-in guesses, wallet challenges and the public play counter. Proposed: refuse `0` when `APP_ENV` is `preview` or `production`. It was not changed here because it could stop a deployment that already runs with an explicit `0`; the owner should confirm none does.

### F-4 Accepted, to revisit for partner games. A game can navigate its own frame away

`sandbox="allow-scripts"` and `connect-src 'none'` stop a game calling the network, but a sandboxed frame may still navigate itself, and the new page is not under the game's CSP. It would still only hold what the host gave the game: the opaque player id, the player's saves, and the wallet address if the game declared the wallet capability. Today only games the platform builds and reviews are played in the frame (an external game gets no capabilities), so the exposure is the reviewed code of our own games. Before partner games are admitted (task #153), decide what the host gives such a game, and whether to hand it the wallet address at all.

### F-5 Observation. A replay holds a database transaction open

The run service replays inside the settling transaction (`packages/game-runs/src/drizzle-repository.ts`), so a slow replay (up to the 2 s limit) holds a connection and the run's row lock. It is bounded by the per-person limit of 30 a minute, but many accounts could tie up the pool. Covered by the sandboxed worker pool planned in ADR-024 (task #153): the replay moves out of the transaction.

### F-6 Open question for the owner. What a self-reported milestone may mint

ADR-018 Amendment 2 lets a self-reported milestone mint "within limits" and says the policy values are the owner's to set. No typed policy that limits what a self-reported milestone can mint was found in `configs/`; a claim is bounded only by the milestone's own claim limit per account. A player can therefore claim every milestone a game leaves self-reported by syncing them, paying the chain and platform fees. That is the documented design; this finding records that the limit the amendment promises is not in the code, and that F-1 is what keeps replay-verified milestones out of that path.

## Not covered by this review

- No penetration test against a running deployment, and no review of the wallet library or the Alkanes contracts.
- The sandboxed verifier pool for outside games does not exist yet (ADR-024); until it does, no outside game gets replay-verified milestones.
- The CSP for the platform's own pages (tasks #51 and #56) was not reviewed.
- Browser behaviour of the frame was checked through the existing markup and header tests, not by driving a hostile game in a real browser.
