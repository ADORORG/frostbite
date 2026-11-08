// What a shared link says. One catalogue, used by the page a link opens and by the preview picture a post shows, so they cannot disagree.
// Nothing here claims more than the platform checked: a score is only ever reported by the game, and a milestone says how the account holds it.
export const shareCopy = {
  browse: "Browse games",
  collectionKicker: "Milestones",
  collectionSubtitle:
    "Play games, earn milestones and mint them. Can you collect more?",
  collectionTitle: "A shelf of milestones",
  milestoneKicker: "Milestone",
  milestoneSubtitle: (game: string) =>
    `Earned in ${game}. Can you earn it too?`,
  notFoundBody: "This link is not shared any more, or never was.",
  notFoundTitle: "Nothing to see here",
  // The words a post carries beside the link. What the post says is only what the platform checked: a real score, a real milestone.
  post: {
    collection: "My shelf of milestones. Can you collect more?",
    milestone: (title: string, game: string) =>
      `I earned ${title} in ${game}. Can you?`,
    score: (score: string, game: string) =>
      `Can you beat my ${score} in ${game}?`,
  },
  play: (game: string) => `Play ${game}`,
  scoreKicker: "Score",
  scoreSubtitle: "Can you beat it?",
  scoreTitle: (score: string, game: string) => `${score} in ${game}`,
  // The page a link opens.
  page: {
    criteria: "How it is earned",
    description: "What it is",
    mintCountLabel: (count: number) =>
      count === 1 ? "player has minted this" : "players have minted this",
    minted: (day: string) => `Minted ${day}`,
    moreOnShelf: (count: number) =>
      `+${count.toLocaleString("en-US")} more on this shelf`,
    mintedBadge: "Minted",
    milestoneKicker: "Milestone unlocked",
    milestoneCta: {
      body: "Play it, earn it, and make it yours.",
      title: "Think you can earn it?",
    },
    scoreCta: {
      body: "Take the same game for a run and see where you land.",
      title: "Think you can beat it?",
    },
    scoreKicker: "High score",
    scoreLabel: "points",
    shelfCta: {
      button: "Start playing",
      body: "Play games, earn milestones, and mint them to a shelf of your own.",
      title: "Build a shelf of your own",
    },
    shelfKicker: "Trophy shelf",
    shelfTitle: (pieces: number, games: number) =>
      `${pieces.toLocaleString("en-US")} ${pieces === 1 ? "milestone" : "milestones"} from ${games.toLocaleString("en-US")} ${games === 1 ? "game" : "games"}`,
    inGame: "in",
    newBest: (game: string) => `New best in ${game}`,
  },
  verification: {
    "replay-verified": "Verified by replay",
    "self-reported": "Self-reported",
  },
} as const;
