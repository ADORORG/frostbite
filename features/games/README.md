# `@frostbite/feature-games`

The public games catalog and game detail pages, the frame that plays an embedded game, and the API routes that save a
signed-in player's progress and milestones and start and settle their replay-verified runs. A game is a manifest (`@frostbite/shared/games`); the host
page connects it to the platform through `@frostbite/game-sdk`.

## Public API

`createGamesFeature(games, chains, wallet, runs)` returns the feature registration: `/games`, `/games/[slug]`, and a
"Games" navigation item, `POST /api/v1/games/sync` (authenticated; rate limited as `syncGameState`; the service is
`@frostbite/game-saves`), and `POST /api/v1/games/runs/start` and `/submit` (authenticated; rate limited as `startGameRun` and
`submitGameRun`; the service is `@frostbite/game-runs`, with the verifiers loaded from the games' built files under `runs.playRoot`,
`configs/game-runs.ts`). The games come from `configs/games.ts`, one line per game.

Each game page declares its own title, summary and a share picture (`src/metadata.ts`); the games page is shared only when a game is
registered. The picture is drawn by the web app at `/games/[id]/share-image` (title, summary and the game's cover when it is a
PNG, JPEG or SVG). `sitemapPaths` lists `/games` and every registered game.

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

## Sharing (SHARE-1)

A signed-in player can make a link to something they earned: a milestone they hold, their shelf of milestones, or a score. The link is
`/s/<id>` (`POST /api/v1/games/shares`, authenticated; `POST /api/v1/games/shares/revoke` ends the player's own link). The service and
table are `@frostbite/game-shares`; the rules it enforces are in that package's README. A milestone share takes its level
(`replay-verified` or `self-reported`) from the account, never from the request, and a score is always `self-reported`, because no replay
verifier returns a score.

`/s/<id>` is a public page (`ui/shared-page.tsx`) and `/s/<id>/share-image` (in the web app, built with `shareCardResponse`) is the
picture a link preview shows. Both are made from the same `sharedView` (`domain/shared-view.ts`) and the same wording
(`domain/share-copy.ts`), so they cannot disagree. Neither carries anything about who shared: no name, wallet or email. A link that is
ended, never was, names a game that is no longer listed or a milestone it no longer declares, shows "not shared" and gives previews no
metadata. A preview picture is cached for up to an hour at the edge, so an ended link's picture can be seen for that long.

### Sharing a new best and a held milestone (SHARE-1d)

In a game, the platform reads the best score from the progress the game saves (`{ best }`, the SDK's `Progress`), so no game has to say it:
the best the game loaded is the bar, and a save that beats it is a new best (`domain/best-score.ts`, watched in `use-game-session.ts`).
A signed-in player whose progress is on their account (`sync === "account"`) then gets a small **Share** chip in the game's top bar, outside
the picture and never over the play area, that shares that score; the page it opens calls it self-reported, because no replay verifier
returns a score. A milestone the player holds has the same chip on its card in the game's milestone list. A player with no account sees
neither, because a link is made from the account's own records.

## The Minted gallery (M2)

A game that mints milestones has a **Minted** section in its dock: how many players minted each milestone, then every mint, newest first, a
page at a time (`ui/minted-gallery.tsx`). It is public. It is read from `GET /api/v1/games/gallery?gameId=` (a page of 24; `cursor` for the
next; the per-milestone counts only with the first page) and each picture from `GET /api/v1/games/gallery/picture?claimId=`, which reads
the picture as the player the completed claim belongs to and answers "not found" for a claim that is not complete or is of a game the
platform does not list. Owner decisions (2026-10-27, confirmed 2026-11-08): every mint appears, the wallet in short form (shortened on the
server, so the whole address never leaves it), no opt-in; each mint says whether the platform replayed the run (`replay-verified`) or the
game only reported it (`self-reported`); the words are "minted to", never "owned by" (nothing locks a mint to its wallet, and the wallet
paid may not be the player); only claims the network's records show complete. Counting (`completeCounts`) reads one row per
milestone from `game_milestone_mint_totals`, kept by triggers on the claims table, so it costs the same however many mints there are; the
answer is still cached for a minute, which only spares the database a repeated read.

## The Leaderboard (LB-1)

A game the platform replays (it publishes a `verification.replay` verifier, so `PublicGame.scored`) has a **Leaderboard** section in its
dock (`ui/leaderboard.tsx`): the best **verified** score of each signed-in player for all time, this month or this week (UTC), 25 places,
a podium for the top three, and the signed-in player's own place underneath. Nothing a game merely reports is ranked. It is read from
`GET /api/v1/games/leaderboard?gameId=&window=` (public, cached 60 s) and `GET /api/v1/games/leaderboard/me?...` (the session's own
place; never a player named in the request). A row names a player only when they switched their public profile on (name, picture, a link
to `/p/<name>`); otherwise it is "A player" with no identifier. Ties share a rank and the player who reached the score first is listed
first. The numbers come from `game_score_bests`, kept by a trigger on `game_runs` (see `@frostbite/game-runs`), so a read costs the same
however many runs there are. A game with no replay verifier has no board (the route answers "not found").

## Searching the games page

`/games` has a search box and filters over the wall of covers (`ui/games-browser.tsx`). The whole catalog is already on the page, so it
answers on every keystroke with no request: `domain/search-games.ts` is a pure function from the games and a query to the matching games,
best first. Every word typed must be found, as the start of a word, in a game's title, tags, summary, description or milestone titles (case
and accents ignored; "frostbreaker" finds FROST·BREAKER); a title or tag hit ranks above a summary hit, and a title that is the whole query first of
all. Titles and tags forgive a slipped letter in a word of four letters or more (`domain/typo.ts`); text a game wrote does not. Kinds are
the closed list `gameTags` (`@frostbite/shared/games`, `tags` in the manifest, one to four per game): chosen kinds match any of them, "Playable
now" narrows to games a player can open. A narrowed wall drops the featured first card and the place numbers.

The query lives in the address (`?q=snow&tag=puzzle&playable=1`, `domain/game-query.ts` reads and writes it, trusting none of it): the
server renders the first paint from it (the page receives `searchParams`), so a shared link opens already narrowed; later changes replace
the history entry instead of adding one. `/` jumps to the box, Escape empties it and then leaves it.

## Onboarding a game (the template)

1. Run `pnpm game:new <id>` (it copies the starter in `tooling/game-tools/template`) and write the game (see `docs/product/game-onboarding.md`, the full guide).
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
  The claim dialog lists the claim's transaction once it has one, linked to the explorer named by `GameWalletConfig.explorerTxUrl` (`betaChain.explorerTxUrl`), through the shared `@frostbite/feature-chain-status/transaction`.
  and the review opens in a dialog (`claim-dialog.tsx`) above the dock. Without a signer the dialog says which is missing: no
  wallet connected, or a connected wallet that cannot sign claims. The platform checks what was signed against what it built.
- The feature performs no mint or on-chain operation of its own. For a game that declared the `wallet`
  capability it mounts the wallet connection on the game's page and passes the game only the connected wallet's
  public address and network (`wallet-game-player.tsx`); a game that did not declare it gets no wallet provider. The only persistence is the sync route (which also returns the player's random per-game id, kept on the save row), which
  stores the player's own state for a listed game and its declared milestones, never anything a request names
  for another player. Milestones are labelled self-reported.
- The keyboard is the game's, without moving focus. A game hears keys only inside its own frame, but focusing the frame on load would
  take the first Tab from the page's skip link. So `use-key-forwarding.ts` tells a connected game (`key.forwarded`) about the keys
  pressed while nothing on the page has focus (`forwardPageKeys` in the SDK's `host-keys.ts` decides, shared with the local test page: letters, digits, arrows, Space, Enter; never Tab or
  Escape, a shortcut, or a key a control or the frame already has), and stops the page scrolling for Space and the arrows it handed over.
  `tests/e2e/tests/game-keyboard.spec.ts` checks every game in a real browser, with no click first.

## Dependencies and configuration

Depends on plugin contracts, `@frostbite/shared` (manifest schema, chain options), `@frostbite/wallet` (the wallet
connection, mounted only for a game that declared `wallet`) and shared UI. `createGamesFeature` takes the wallet
configuration (`GameWalletConfig`: network and the connection page's address) from `configs/wallet.ts`. It reads no
environment value; where a game is played is supplied by the platform's configuration (`GAME_LAUNCHES`, applied
in `configs/games.ts`) before the manifests reach the feature.

## Verification

`typecheck`, `test:unit`, `test:integration`, `test:coverage`. Browser, accessibility, responsive,
reduced-motion and visual behavior is covered by Playwright.

## Ownership

Platform games team.

## Hot games (HOT-1)

The platform counts a run started in a game (the page counts it, when the game asks for a run, signed in or not: `client/plays-api.ts`, called from
`client/runs-port.ts`) through the public `POST /api/v1/games/play` (`application/plays-operations.ts`, limited per address) into `game_play_days`. The
ranking (`rankGames` in `@frostbite/game-runs`) is read per page view through `plays-runtime.ts` (kept 60 s) and drawn by `GamesRail` (the "Hot right now"
rail), `GamesBrowser` (ranked games first, `domain/heat-order.ts`) and every card (`ui/heat-badges.tsx`: sticker, rim, meter). See
`docs/product/hot-games.md` for what counts, what is hot and the design.
