# Onboarding a game (the template)

Status: the manifest, the catalog and the game page exist (task W8-01). The host protocol, the milestone claim
path and the generator are later tasks (GP-02 to GP-08, blocked on ADR-018); this page says what works now and
what each later step adds.

## What a game is

A game is one file: a manifest written with `defineGame` (`@ador/shared/games`). The platform lists the games in
`configs/games.ts`, one line each. The catalog and the game page read that list; no platform code is edited to
add a game. A manifest that fails its checks stops the platform from starting, so a mistake shows up at once.

```ts
import { defineGame } from "@ador/shared/games";

export const myGame = defineGame({
  schemaVersion: 1, // the manifest format
  id: "my-game", // lower-case words and hyphens; it is the page address
  title: "My game",
  summary: "One sentence for the list.",
  description: "A longer text for the game's page.",
  version: "0.1.0", // the game's own release version
  network: "bip122:00000008819873e925422c1ff0f99f7c", // the chain its on-chain actions use (must be configured)
  launch: { mode: "external", url: null, basePath: "", returnUrl: null }, // no host = registered, not playable yet
  capabilities: ["wallet", "run:submit"], // what it will ask the host for; declarations only for now
  milestones: [
    {
      id: "first-level",
      title: "First level",
      description: "You finished the first level.",
      criteria: "Finish level 1.", // shown to players: how it is earned
      claimPolicy: "once", // "once" per player, or "repeatable"
    },
  ],
});
```

Then add `myGame` to the list in `configs/games.ts`.

## Where a game is played (deployment configuration)

A deployment, not the manifest, says where each game is played. Set `GAME_LAUNCHES` (one JSON value, keyed by
game id) in the environment; the same build then serves any hosting style:

```json
{
  "my-game": {
    "url": "https://play.example.com",
    "basePath": "",
    "returnUrl": "https://example.com/games/my-game",
    "network": "bip122:00000008819873e925422c1ff0f99f7c"
  }
}
```

- `url`: the host only, no path or trailing slash. The play address is the host plus the base path.
- `basePath`: blank when the game has the whole host (subdomain style); `/play/my-game` when it is served from a
  path of a host (domain-path style). Safe segments only, no trailing slash.
- `returnUrl`: where the game sends the player back to; must be on `PUBLIC_BASE_URL`'s origin. Blank means the
  platform's own page for the game.
- `network`: optional chain reference; must be a chain the platform is configured for.
- Preview and production require an HTTPS host. A setting that names a game that is not registered, a bad value,
  or a chain that is not configured stops the platform from starting. Blank lists every game as not playable.

Adding a game never adds an environment key: it adds an entry to this value. A worked example with every field is the test fixture
`features/games/test/support/template-game.ts`; the real first game is `configs/games/frostbite.ts`.

## What the platform guarantees about a listed game

- Its page shows exactly what the manifest declares, with a digest of those declarations, so a change to a
  milestone or play address is visible as a new digest and a new `version`.
- A game with no play address is "Not playable yet". It is never shown as live.
- Capabilities and milestones are shown as **declarations**. The page says the platform does not grant the
  capabilities yet, cannot claim milestones on chain yet, and cannot verify what happens inside a game.

## Checks a manifest passes (enforced when the platform starts)

Strict fields only; identifier shape and uniqueness across games; http or https play address (never `javascript:`
or `file:`); capabilities from the known list, none twice; milestone ids unique within the game; every text
bounded (see `gameManifestLimits`); the network is a valid chain reference. Production-only address rules
(HTTPS, allowed origins) come with the play-address configuration in W8-02.

## Testing a first game today

1. Write the manifest and add it to `configs/games.ts`; run `pnpm typecheck` and the games feature tests.
2. Start the local stack (`pnpm stack`) and open `/games` and `/games/<id>`: the card, the state, the milestones
   as declared.
3. Set `GAME_LAUNCHES` for the game (for local use, `http://localhost:<port>` is allowed) to play it from the page.

## What "milestones minted to a player's account" still needs

Declaring a milestone does not make it earnable or mintable. The path in ADR-018 (still **proposed**) is:
the game's own server decides a milestone was earned and asks a platform attestation service for a short-lived,
single-use attestation for that player; the player's wallet signs the claim transaction with the attestation;
a reviewed `game-rewards@1` contract checks it and mints. In the product the states are **earned**, **claim
pending**, **claimed** and **complete**, and "minted" is never shown before the indexed state agrees.

| Step                                                                    | Task  | Blocked on                              |
| ----------------------------------------------------------------------- | ----- | --------------------------------------- |
| Accept ADR-018 and the signature-verification spike on the target chain | GP-00 | the owner's decision; spike not started |
| Manifest gains contracts, capabilities and hashed milestone definitions | GP-01 | GP-00                                   |
| Game SDK and host protocol (`milestone:claim`, origin checks)           | GP-02 | GP-01                                   |
| Conformance suite and a simulated game                                  | GP-03 | GP-02                                   |
| Runnable template and one-line generator                                | GP-04 | GP-02, GP-03                            |
| `game-rewards@1` contract                                               | GP-05 | GP-00, contract tooling                 |
| Attestation service (keys, nonces, rate limits, pause, audit)           | GP-06 | GP-00, GP-01                            |
| Milestone claim through the quote, sign, broadcast, observe pipeline    | GP-07 | GP-05, GP-06, the mint pipeline         |
| Player milestone states in the host and game page                       | GP-08 | GP-07                                   |

Until those exist, a first game can be listed, described and linked, and its milestones declared and reviewed
as data. Linking milestones to a player's account is the work above; nothing in the current pages pretends
otherwise.
