import { tone, type Effect } from "@ador/game-sdk/audio/effects";

// The effects of the quest's newer things, kept apart from the first ones (`audio.ts`) so each file stays short: a spring, a secret
// area found, a door through to it, the wings and their flaps, and the forcefield.
export const moreEffects = {
  flap: [tone("sine", 500, 900, 0.07, 0.18)],
  secret: [
    tone("sine", 784, 784, 0.08, 0.25),
    tone("sine", 988, 988, 0.08, 0.25, 0.08),
    tone("sine", 1319, 1319, 0.2, 0.25, 0.16),
  ],
  shield: [
    tone("sine", 300, 1200, 0.25, 0.22),
    tone("triangle", 1200, 1600, 0.2, 0.15, 0.1),
  ],
  spring: [tone("sine", 220, 880, 0.18, 0.3)],
  whoosh: [tone("noise", 0, 0, 0.3, 0.15), tone("sine", 1200, 300, 0.3, 0.15)],
  wings: [
    tone("triangle", 660, 990, 0.1, 0.25),
    tone("triangle", 990, 1320, 0.15, 0.25, 0.1),
  ],
} as const satisfies Record<string, Effect>;
