// The colours of the screen, by what they are. Glitchy's are the colours of the explainer: mint, lavender, hot pink, cyan and cream on a
// night-purple world.
export const colour = {
  belly: "#f2fff9",
  berry: "#ff4f5e",
  berryDark: "#a8243a",
  blush: "#ff8fc4",
  cloud: "#9aa3c7",
  cloudDark: "#5d6690",
  cream: "#fff0c2",
  creamDark: "#e9c66b",
  cyan: "#38f3ff",
  deep: "#0c0620",
  dirt: "#7a4a2e",
  dirtDark: "#4f2c1a",
  eye: "#1a0f3a",
  fire: "#ff9a2e",
  fireHot: "#fff27a",
  gold: "#ffd84d",
  goldDark: "#c98a14",
  grass: "#5fd068",
  grassDark: "#2f9a48",
  ice: "#aef0ff",
  iceDark: "#4aa8d8",
  ink: "#1d1140",
  lavender: "#b98cff",
  lavenderDark: "#7d55d9",
  leaf: "#3fae5a",
  mint: "#5beac6",
  mintDark: "#2fb898",
  pink: "#ff5fd2",
  shadow: "rgb(0 0 0 / 0.28)",
  stone: "#8f97b3",
  stoneDark: "#555c78",
  white: "#ffffff",
  wood: "#c98a54",
  woodDark: "#7a4a2e",
} as const;

// The four friends of the guild, by their colour and its shade: Bolt, Splash, Bloom and Spark.
export const friendColours: readonly (readonly [string, string])[] = [
  ["#ff9f43", "#c4661c"],
  ["#48b8fb", "#2a6fd0"],
  ["#7bd96b", "#3d9b3a"],
  ["#ffd84d", "#c9a226"],
];

// The sky of each hill stage, top to bottom: morning, afternoon, sunset.
export const hillSkies: readonly (readonly [string, string, string])[] = [
  ["#6ec6ff", "#c9f1ff", "#8ed88a"],
  ["#4a8fe8", "#ffe6a8", "#6fbf6a"],
  ["#3b2a7a", "#ff9e7a", "#5d9a5a"],
];
