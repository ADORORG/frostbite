// The colours of the screen: the platform's deep violet, with the warm light of the lantern.
export const colour = {
  black: "#05020f",
  cyan: "#38e8ff",
  danger: "#ff4757",
  door: "#9d8cff",
  doorOpen: "#56f5a6",
  flame: "#ffd23f",
  flameHot: "#fff2b0",
  flask: "#ff9f43",
  footprint: "#120a2e",
  flaskGlass: "#ffd9a8",
  floorFar: "#4a3a2a",
  floorNear: "#8a6a3c",
  floorMid: "#6a5030",
  floorSeen: "#241a30",
  key: "#ffd23f",
  text: "#ece8ff",
  wall: "#9d8cff",
  wallSeen: "#4a3f80",
} as const;

// The floor of a cell that is lit now, by how many steps it is from the lantern.
export const floorByDistance = [
  colour.floorNear,
  colour.floorNear,
  colour.floorMid,
  colour.floorFar,
  colour.floorFar,
] as const;
