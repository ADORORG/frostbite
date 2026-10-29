// What the player's collection of mints says. Minting is complete only when the network's records show it, so nothing here counts a
// claim that is still on its way.
export const mintedCopy = {
  empty:
    "You have not minted a milestone yet. Earn one in a game and claim it; it will be on your shelf once the network shows it.",
  failed: "Your milestones could not be loaded. Try again in a moment.",
  firstMinted: (day: string) => `First minted ${day}`,
  gameLabel: "Game",
  gamesCount: (games: number) =>
    games === 1 ? "in 1 game" : `across ${String(games)} games`,
  intro:
    "Milestones you have claimed, listed once the network's records show them.",
  latestMinted: (title: string, day: string) => `Latest: ${title}, ${day}`,
  loading: "Loading your milestones",
  mintedLabel: "Minted",
  minted: (day: string) => `Minted ${day}`,
  mintedProgress: (earned: number, total: number) =>
    `${String(earned)} of ${String(total)} minted`,
  noPicture: "Picture not available",
  notMinted: "Not minted yet",
  openGame: "Open game",
  piecesCount: (pieces: number) =>
    pieces === 1 ? "1 milestone" : `${String(pieces)} milestones`,
  progressLabel: (game: string) => `${game}: milestones minted`,
  ribbon: { first: "First", latest: "Latest" },
  shelfTitle: (game: string) => `${game} shelf`,
  signedOut: "Sign in to see the milestones you have minted.",
  title: "My milestones",
  transaction: "Transaction",
  viewPiece: (title: string, game: string) => `${title}, ${game}: details`,
} as const;
