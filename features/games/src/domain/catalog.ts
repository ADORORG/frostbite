import { scenes } from "@frostbite/scenes/library";
import { requiredCapability } from "@frostbite/game-sdk/protocol";
import type { ChainOption } from "@frostbite/shared/chain";
import {
  embeddedGameAssetPath,
  embeddedGamePath,
  gameIdSchema,
  gameManifestHash,
  gamePlayAddress,
  type GameCapability,
  type GameTag,
  type GameManifest,
  type GameMilestone,
} from "@frostbite/shared/games";

// What a person is told about each thing a game may ask the host for. Only the ones the host protocol answers
// (see `requiredCapability`) are granted, and only to a game the platform plays itself; the rest are
// declarations, and the page says which is which.
export const gameCapabilityLabels: Readonly<Record<GameCapability, string>> = {
  "balance:read": "Read the player's balance",
  "milestone:claim": "Start a claim for a milestone the player earned",
  "run:submit": "Submit a finished run",
  "transaction:request": "Ask the player to sign a transaction",
  wallet: "See the address of the wallet the player connected",
};

const sceneIds: ReadonlySet<string> = new Set(scenes.map(({ id }) => id));

const hostGranted: ReadonlySet<string> = new Set(
  Object.values(requiredCapability),
);

// One thing a game declared, and whether the platform will actually grant it.
export interface PublicCapability {
  readonly available: boolean;
  readonly id: GameCapability;
  readonly label: string;
}

export const gameMilestonePolicyLabels: Readonly<
  Record<GameMilestone["claimPolicy"], string>
> = {
  once: "Once per player",
  repeatable: "Can be earned again",
};

// A game's preview as the pages show it: addresses the platform serves, never a place the game chose.
export interface PublicCover {
  readonly alt: string;
  readonly image: string;
  readonly video: string | null;
}

// One game as the public pages show it, taken from its manifest and nothing else.
export interface PublicGame {
  readonly capabilities: readonly PublicCapability[];
  // Whether the game declares a rewards contract, so its milestones can be claimed on chain (when the platform can take claims).
  readonly claimable: boolean;
  // Whether the platform replays the game's runs and so has a verified score to rank, which is what a leaderboard needs.
  readonly scored: boolean;
  // The preview the catalog shows, or null for a game that has none (the pages draw a stand-in).
  readonly cover: PublicCover | null;
  readonly description: string;
  // Where the platform serves the game's files when it plays the game itself, in an isolated frame, or null.
  readonly embedSrc: string | null;
  // The exact declarations this page was made from, as a digest, so a change is visible.
  readonly hash: string;
  readonly id: string;
  readonly milestones: readonly GameMilestone[];
  readonly networkLabel: string;
  // Whether a player can open it from here: it has an address, or the platform plays it itself.
  readonly playable: boolean;
  // Where to play, or null when the game is registered but has no play address configured.
  readonly playUrl: string | null;
  // The scene the game asked for on its card (by id), or null when it left the choice to the platform.
  readonly scene: string | null;
  readonly summary: string;
  // What the game is like, from the platform's list (the games page filters by it).
  readonly tags: readonly GameTag[];
  readonly title: string;
  readonly version: string;
}

export interface GameCatalog {
  find(slug: string | undefined): PublicGame | null;
  // False for an identifier that cannot be a game's, so a page can tell "not valid" from "not found".
  isValidSlug(slug: string | undefined): boolean;
  list(): readonly PublicGame[];
}

// The registered games, read-only. Nothing here reaches the network, the wallet or the chain: a game is
// whatever its manifest says, and a game with no play address is shown as not playable, never as live.
export function createGameCatalog(
  games: readonly GameManifest[],
  chains: readonly ChainOption[],
): GameCatalog {
  for (const { id, scene } of games) {
    if (scene !== undefined && !sceneIds.has(scene))
      throw new Error(
        `Game "${id}" names a scene the platform does not have: "${scene}".`,
      );
  }
  const presented = games.map((game): PublicGame => ({
    capabilities: game.capabilities.map((capability) => ({
      available: game.launch.mode === "embedded" && hostGranted.has(capability),
      id: capability,
      label: gameCapabilityLabels[capability],
    })),
    claimable: game.launch.mode === "embedded" && game.rewards !== undefined,
    scored: game.verification !== undefined,
    cover:
      game.cover === undefined
        ? null
        : {
            alt: game.cover.alt,
            image: embeddedGameAssetPath(game.id, game.cover.image),
            video:
              game.cover.video === null
                ? null
                : embeddedGameAssetPath(game.id, game.cover.video),
          },
    description: game.description,
    embedSrc:
      game.launch.mode === "embedded" ? embeddedGamePath(game.id) : null,
    hash: gameManifestHash(game),
    id: game.id,
    milestones: game.milestones,
    networkLabel:
      chains.find(({ chainId }) => chainId === game.network)?.displayName ??
      game.network,
    playable:
      game.launch.mode === "embedded" || gamePlayAddress(game.launch) !== null,
    playUrl: gamePlayAddress(game.launch),
    scene: game.scene ?? null,
    summary: game.summary,
    tags: game.tags,
    title: game.title,
    version: game.version,
  }));
  const byId = new Map(presented.map((game) => [game.id, game]));
  return {
    find: (slug) => (slug === undefined ? null : (byId.get(slug) ?? null)),
    isValidSlug: (slug) => gameIdSchema.safeParse(slug).success,
    list: () => presented,
  };
}
