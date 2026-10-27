// What the player's collection of mints says. Minting is complete only when the network's records show it, so nothing here counts a
// claim that is still on its way.
export const mintedCopy = {
  edition: (edition: number) => `Edition ${String(edition)}`,
  empty:
    "You have not minted a milestone yet. Earn one in a game and claim it.",
  failed: "Your milestones could not be loaded. Try again in a moment.",
  intro:
    "Milestones you have claimed, listed once the network's records show them.",
  loading: "Loading your milestones",
  minted: (day: string) => `Minted ${day}`,
  noPicture: "Picture not available",
  openGame: "Open game",
  signedOut: "Sign in to see the milestones you have minted.",
  title: "My milestones",
} as const;
