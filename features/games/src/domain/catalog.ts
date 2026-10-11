import type { ChainOption } from "@ador/shared/chain";
import {
  gameIdSchema,
  gameManifestHash,
  gamePlayAddress,
  type GameCapability,
  type GameManifest,
  type GameMilestone,
} from "@ador/shared/games";

// What a person is told about each thing a game may ask the host for. Declarations only for now: the host
// protocol that grants or refuses them is a later task, and the page says so.
export const gameCapabilityLabels: Readonly<Record<GameCapability, string>> = {
  "balance:read": "Read the player's balance",
  "run:submit": "Submit a finished run",
  "transaction:request": "Ask the player to sign a transaction",
  wallet: "Connect the player's wallet",
};

export const gameMilestonePolicyLabels: Readonly<
  Record<GameMilestone["claimPolicy"], string>
> = {
  once: "Once per player",
  repeatable: "Can be earned again",
};

// One game as the public pages show it, taken from its manifest and nothing else.
export interface PublicGame {
  readonly capabilities: readonly string[];
  readonly description: string;
  // The exact declarations this page was made from, as a digest, so a change is visible.
  readonly hash: string;
  readonly id: string;
  readonly milestones: readonly GameMilestone[];
  readonly networkLabel: string;
  // Where to play, or null when the game is registered but has no play address configured.
  readonly playUrl: string | null;
  readonly summary: string;
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
  const presented = games.map((game): PublicGame => ({
    capabilities: game.capabilities.map(
      (capability) => gameCapabilityLabels[capability],
    ),
    description: game.description,
    hash: gameManifestHash(game),
    id: game.id,
    milestones: game.milestones,
    networkLabel:
      chains.find(({ chainId }) => chainId === game.network)?.displayName ??
      game.network,
    playUrl: gamePlayAddress(game.launch),
    summary: game.summary,
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
