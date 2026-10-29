// How the scenes are run, as named values: nothing below is a magic number.
export const playbackLimits = {
  // The most scenes that move at once; the rest show a still frame. A page of many cards costs the same as a page of a few.
  maxRunning: 6,
  // Frames a second. A backdrop fills the view and is looked at; a card overlay is small and is one of many.
  backdropFps: 30,
  overlayFps: 20,
  // How often the nearest scenes are chosen again, in milliseconds.
  rankEveryMs: 400,
  // A device reporting this much memory (in gigabytes) or less is treated as too weak to animate by default.
  lowMemoryGb: 2,
} as const;

export type Playback = "play" | "still";

// What the person chose with the switch, or nothing if they have not.
export type UserChoice = "off" | "on";

// What the device asks for or can bear.
export interface DeviceSignals {
  readonly lowPower: boolean;
  readonly reducedMotion: boolean;
  readonly saveData: boolean;
}

// Whether scenes move. The person's own choice always wins (someone who turned animation on on a phone that asked for less gets it, and
// someone who turned it off gets none); with no choice, any request from the device for less motion or less data is honoured.
export function playbackFor(
  device: DeviceSignals,
  choice: UserChoice | null,
): Playback {
  if (choice === "off") return "still";
  if (choice === "on") return "play";
  return device.reducedMotion || device.saveData || device.lowPower
    ? "still"
    : "play";
}
