// The colours of the screen: the platform's neon on its deep violet. Each kind of shard has a colour and a shape of its own, so the
// kinds can be told apart without telling the colours apart.
export const colour = {
  back: "#0c0620",
  cursor: "#38e8ff",
  danger: "#ff4757",
  grab: "#ffd23f",
  panel: "#1b1250",
  panelLine: "#3a2870",
  text: "#ece8ff",
  textDim: "#9d8cff",
  white: "#ffffff",
} as const;

export const kindColours = [
  "#38e8ff",
  "#ff4f8b",
  "#ffd23f",
  "#56f5a6",
  "#ff9f43",
  "#b58cff",
] as const;

// The darker tone of each kind's colour, for the underside of a shard (it makes the flat shape look rounded).
export const kindShades = [
  "#1b9fb8",
  "#b82c62",
  "#c29a12",
  "#2a9e6a",
  "#c26a1c",
  "#7a58c4",
] as const;

export const frostColour = "#cfefff";
