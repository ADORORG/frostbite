// What the landing page's hero says.
export const homeCopy = {
  actions: {
    arcade: "▶ Enter arcade",
    collections: "Collections",
    launches: "Launches",
  },
  eyebrow: "Foundation build in progress",
  headline: { first: "Launch your legacy.", second: "Mint the future." },
  lede: "A self-custodial launchpad and game arcade for Bitcoin Alkanes. Transactional actions stay gated until their product decisions and end-to-end checks pass.",
  nowPlaying: "Now playing",
  pickNext: "Next scene",
  pickPrevious: "Previous scene",
  status: {
    features: (count: number) => `${String(count)} registered`,
    featuresLabel: "Features",
    launchesGated: "Gated",
    launchesLabel: "Launches",
  },
} as const;
