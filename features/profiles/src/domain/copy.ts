import type { ProfileNameReason } from "@frostbite/shared/profiles";

// Every sentence the profile pages say, in one place, so no wording is written twice and a change of voice is one edit. A sentence that
// depends on the deployment's rules takes them as arguments (the bounds come from the server, never from here).
const dateOf = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(iso));

export const profileCopy = {
  setup: {
    avatar: {
      legend: "Fighter",
      lead: "Twelve to pick from. Swap any time.",
      title: "Choose your fighter",
    },
    delete: {
      cancel: "Keep it",
      confirm: "Yes, delete it",
      done: "Your profile is gone. Make a new one any time.",
      lead: "This removes your name, fighter and page, and frees the name. Your scores and milestones are not touched.",
      open: "Take my profile down",
      title: "Not feeling it?",
    },
    errors: {
      load: "We couldn't load your profile.",
      remove: "We couldn't take it down. Try again.",
      retry: "Try again",
      save: "We couldn't save that. Check your connection and try again.",
    },
    hero: {
      eyebrow: "Player profile",
      lead: "Pick a fighter and a name. Your page shows your best verified scores and the milestones you've minted, and nothing else.",
      title: "Make your player card",
    },
    name: {
      count: (length: number, max: number) =>
        `${String(length)}/${String(max)}`,
      hint: (min: number, max: number) =>
        `${String(min)}–${String(max)} letters, numbers, _ or -`,
      label: "Player name",
      lead: "This is your page's address, so it has to be plain.",
      title: "Name your player",
    },
    preview: { label: "Live preview", placeholder: "Your name" },
    saved: {
      hidden: "Saved. Your page stays hidden until you switch it on.",
      link: "Your page is live:",
      title: "You're on the map!",
      view: "View my page",
    },
    save: {
      busy: "Saving…",
      idle: "Save profile",
      unchanged: "Nothing to save",
    },
    visibility: {
      label: "Show my profile page",
      neverShown:
        "Never shown: your email, your wallet address or your account id.",
      off: "Hidden. There is no page, and nobody can find your name.",
      on: "Anyone with your link can see your name, fighter, best verified scores and minted milestones.",
      title: "Show your page",
    },
  },
  nameStatus: {
    available: "Free: it's yours if you save.",
    checking: "Checking…",
    failed: "Couldn't check that name. You can still try to save it.",
    locked: (until: string) =>
      `You can change your name again on ${dateOf(until)}.`,
    taken: "Someone already has that name.",
    yours: "That's your name.",
  },
  nameReason: (
    reason: ProfileNameReason,
    bounds: { readonly maxLength: number; readonly minLength: number },
  ): string => {
    switch (reason) {
      case "blocked":
        return "That name isn't available. Try another.";
      case "bad-characters":
        return "Letters, numbers, _ and - only, starting with a letter or number.";
      case "too-long":
        return `Keep it to ${String(bounds.maxLength)} characters or fewer.`;
      case "too-short":
        return `Use at least ${String(bounds.minLength)} characters.`;
    }
  },
  card: {
    joined: (iso: string) =>
      `Joined ${new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC", year: "numeric" }).format(new Date(iso))}`,
    ribbon: "Player card",
    stats: {
      bests: (count: number) =>
        count === 1 ? "verified best" : "verified bests",
      mints: (count: number) =>
        count === 1 ? "milestone minted" : "milestones minted",
    },
  },
  page: {
    browse: "Browse games",
    call: {
      body: "Pick a game and set a score of your own.",
      title: "Think you can beat them?",
    },
    latest: "Latest high score",
    makeYours: "Make your own card",
    mints: {
      empty: {
        body: "Milestones show here once they're minted.",
        title: "Nothing minted yet",
      },
      lead: "Milestones this player has put on chain.",
      title: "Minted milestones",
    },
    scores: {
      beat: "Beat it",
      empty: {
        body: "Scores show here once a game's replay checks a finished run.",
        title: "No verified scores yet",
      },
      lead: "Checked by the platform's own replay, so every number here is real.",
      set: (iso: string) => `Set ${dateOf(iso)}`,
      title: "High scores",
      verified: "Verified",
    },
    share: {
      heading: (name: string) => `${name}'s player card`,
      kicker: "Player card",
      text: (name: string) => `Check out ${name}'s player card`,
    },
  },
  missing: {
    body: "There's no public player card with that name. It may be hidden, or the name may be free for the taking.",
    title: "No player here",
  },
  metadata: {
    description: (name: string) =>
      `${name}'s verified high scores and minted milestones.`,
    title: (name: string) => `${name}'s player card`,
  },
} as const;
