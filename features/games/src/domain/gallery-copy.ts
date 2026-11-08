// What a game's gallery of mints says. A mint is "minted to" a wallet, never "owned by": the platform follows the claim, not who holds the
// item now, and the wallet that was paid may not be the player. Each mint says how the platform knew the milestone was earned.
export const galleryCopy = {
  countsLabel: "Minted so far",
  empty: "Nobody has minted a milestone of this game yet. Be the first.",
  failed: "The gallery could not be loaded. Try again in a moment.",
  intro:
    "Every milestone of this game that the network's records show minted, newest first.",
  loadMore: "Show more",
  loadMoreFailed: "More could not be loaded. Try again.",
  loading: "Loading the gallery",
  mintedTo: (wallet: string) => `Minted to ${wallet}`,
  minted: (count: number) =>
    count === 1 ? "1 minted" : `${count.toLocaleString("en-US")} minted`,
  title: "Minted",
  verification: {
    "replay-verified": "Verified by replay",
    "self-reported": "Self-reported",
  },
} as const;
