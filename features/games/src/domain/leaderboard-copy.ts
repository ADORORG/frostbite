import type { LeaderboardWindow } from "@frostbite/shared/games";

// What a game's leaderboard says. It ranks the best score the platform checked by replaying the run, never one a game reported.
export const leaderboardCopy = {
  anonymous: "A player",
  empty: {
    all: "No verified score yet. Finish a run while signed in and take the first place.",
    month:
      "No verified score this month yet. Finish a run and take the first place.",
    week: "No verified score this week yet. Finish a run and take the first place.",
  },
  failed: "The leaderboard could not be loaded. Try again in a moment.",
  intro:
    "The best scores the platform checked by replaying the run. Only signed-in players are ranked.",
  loading: "Loading the leaderboard",
  place: (rank: number, score: number) =>
    `You are ranked ${rank.toLocaleString("en-US")} with ${score.toLocaleString("en-US")}.`,
  noPlace: "You have no verified score here yet.",
  players: (count: number) =>
    count === 1 ? "1 player" : `${count.toLocaleString("en-US")} players`,
  resets: (days: number, hours: number) =>
    days > 0
      ? `Resets in ${days}d ${hours}h`
      : `Resets in ${Math.max(hours, 1)}h`,
  title: "Leaderboard",
  windowLabel: "Period",
  windows: {
    all: "All time",
    month: "This month",
    week: "This week",
  } satisfies Record<LeaderboardWindow, string>,
} as const;
