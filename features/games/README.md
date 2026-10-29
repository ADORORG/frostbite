# `@ador/feature-games`

The public games catalog and game detail pages, the frame that plays an embedded game, and the API routes that save a
signed-in player's progress and milestones and start and settle their replay-verified runs. A game is a manifest (`@ador/shared/games`); the host
page connects it to the platform through `@ador/game-sdk`.

## Public API

`createGamesFeature(games, chains, wallet, runs)` returns the feature registration: `/games`, `/games/[slug]`, and a
"Games" navigation item, `POST /api/v1/games/sync` (authenticated; rate limited as `syncGameState`; the service is
`@ador/game-saves`), and `POST /api/v1/games/runs/start` and `/submit` (authenticated; rate limited as `startGameRun` and
`submitGameRun`; the service is `@ador/game-runs`, with the verifiers loaded from the games' built files under `runs.playRoot`,
`configs/game-runs.ts`). The games come from `configs/games.ts`, one line per game.

The landing page's rail of games (`homeSections`, `ui/games-rail.tsx`) shows the first six, playable ones first; a game's own cover
clip plays alone, and a game without one gets a scene chosen from its id laid over its picture (`ui/game-cover.tsx`).

`/games/milestones` ("My milestones", signed-in players only) is the player's trophy case: a shelf for every game that can mint
milestones (games with mints first, newest first), with a place for each of the game's milestones: a square picture with the name and the
day (UTC) for a minted one (a medallion of the game cover and the milestone initials when no picture came), the rest listed by name under "still to earn", and one progress segment per milestone. A "First" ribbon marks a
game's earliest mint and "Latest" the newest of all. A header gives the counts and dates. Pressing a piece opens its picture, what the
milestone is, the day and its transaction on the explorer; the cards show no transaction. Sharing the shelf waits for a public page
(M2, #133). It is read from `GET /api/v1/games/milestones/minted`
(authenticated; the player is the session, the request carries nothing), and lists only claims the network's records show
`complete`: a claim that is waiting, delayed or failed has minted nothing. The date is when the platform recorded the claim
complete. Each entry shows the picture the chain serves for the item the claim minted (and the dock's claim list shows it for a complete
claim), read from `GET /api/v1/games/milestones/picture?claimId=` (authenticated; a file, `image/svg+xml`, kept privately by the browser for a day and tied to the session cookie; a claim that is not the player's, or with no picture, is a `404` that says why and is never kept). The page points an image tag at that address; a stand-in of the same size holds the place while it loads and when it fails, and says so. The
platform learns the item's id from the network when the claim's transaction is shown included, and shows the picture only if the item
says it was issued by the contract the claim was made against and is an `image/svg+xml`; otherwise the piece shows no picture, and
never a broken one. It is drawn through an image tag, which cannot run what a drawing holds.

## Onboarding a game (the template)

1. Copy `games/sample-game` and write the game (see `docs/product/game-onboarding.md`, the full guide).
2. Write its manifest with `defineGame` (`launch: { mode: "embedded" }`) in `configs/games/`.
3. Add it to the list in `configs/games.ts`: `defineGames([frostbite, yourGame])`.
4. Run the tests: the catalog, the detail page and the manifest checks pick it up with no other change.

The platform core is not edited to add a game.

## Invariants

- The pages show only what a manifest declares. A game with no play address is "Not playable yet", never
  live. Each capability a game declares is marked "Available" only when the host answers it and the platform plays
  the game itself (today: `wallet`); every other one is marked "Not available yet" and is a declaration only.
  Milestones are shown with how each is known: reported by the game, or replay-checked by the platform, with what that does
  and does not show; the statement that the platform cannot claim them on chain stays.
- A run is started and settled only through the platform's service. The page answers `signed-out` itself when nobody is
  signed in, never invents a seed, and shows "Replay-checked" only for a milestone the account holds as replay-verified.
- A manifest that fails validation stops the platform from starting; it is not skipped.
- Identifiers are unique and are the page address. An address that cannot be an identifier is "Invalid
  route"; a valid one with no game is "Record not published".
- A claim is signed by the player's own connected wallet, from the page and never by the game: `wallet-game-player.tsx`
  takes the signer from `useStepWallet(signingWallets)` (the same policy list staff steps use, `rewardsPolicy.signingWallets`),
  The claim dialog lists the claim's transaction once it has one, linked to the explorer named by `GameWalletConfig.explorerTxUrl` (`betaChain.explorerTxUrl`), through the shared `@ador/feature-chain-status/transaction`.
  and the review opens in a dialog (`claim-dialog.tsx`) above the dock. Without a signer the dialog says which is missing: no
  wallet connected, or a connected wallet that cannot sign claims. The platform checks what was signed against what it built.
- The feature performs no mint or on-chain operation of its own. For a game that declared the `wallet`
  capability it mounts the wallet connection on the game's page and passes the game only the connected wallet's
  public address and network (`wallet-game-player.tsx`); a game that did not declare it gets no wallet provider. The only persistence is the sync route (which also returns the player's random per-game id, kept on the save row), which
  stores the player's own state for a listed game and its declared milestones, never anything a request names
  for another player. Milestones are labelled self-reported.

## Dependencies and configuration

Depends on plugin contracts, `@ador/shared` (manifest schema, chain options), `@ador/wallet` (the wallet
connection, mounted only for a game that declared `wallet`) and shared UI. `createGamesFeature` takes the wallet
configuration (`GameWalletConfig`: network and the connection page's address) from `configs/wallet.ts`. It reads no
environment value; where a game is played is supplied by the platform's configuration (`GAME_LAUNCHES`, applied
in `configs/games.ts`) before the manifests reach the feature.

## Verification

`typecheck`, `test:unit`, `test:integration`, `test:coverage`. Browser, accessibility, responsive,
reduced-motion and visual behavior is covered by Playwright.
