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
  verification: {
    "replay-verified": "Verified by replay",
    "self-reported": "Self-reported",
  },
} as const;
