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
  byGame: "By game",
  emptyGames: (count: number) =>
    `Games with nothing minted yet (${String(count)})`,
  hideEmptyGames: "Hide games with nothing minted",
  latestRow: "Latest",
  moreToEarn: (count: number) => `+${String(count)} more to earn`,
  railLabel: "Choose a game",
  railTile: (title: string, minted: number, total: number) =>
    `${title}: ${String(minted)} of ${String(total)} minted`,
  statGames: (games: number) => (games === 1 ? "game" : "games"),
  statLatest: "Latest",
  statMilestones: (pieces: number) =>
    pieces === 1 ? "milestone" : "milestones",
  lockedSlot: (title: string) => `${title}: not minted yet`,
  stillToEarn: (count: number) => `${String(count)} still to earn`,
  standIn: "No picture",
  openGame: "Open game",
  piecesCount: (pieces: number) =>
    pieces === 1 ? "1 milestone" : `${String(pieces)} milestones`,
  ribbon: { first: "First", latest: "Latest" },
  shelfTitle: (game: string) => `${game} shelf`,
  signedOut: "Sign in to see the milestones you have minted.",
  title: "My milestones",
  transaction: "Transaction",
  viewPiece: (title: string, game: string) => `${title}, ${game}: details`,
} as const;
