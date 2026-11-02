import { tone, type Effect } from "@ador/game-sdk/audio/effects";

// The effects of the quest's newer things, kept apart from the first ones (`audio.ts`) so each file stays short: a spring, a secret
// area found, a door through to it, the wings and their flaps, the forcefield, the guild going up a level, and the backpack (a food
// put in it, a berry's blaze, a glitch blast, growing big and shrinking back).
export const moreEffects = {
  blast: [
    tone("square", 180, 90, 0.25, 0.2),
    tone("noise", 0, 0, 0.35, 0.18, 0.04),
    tone("sawtooth", 900, 1800, 0.12, 0.12, 0.08),
  ],
  blaze: [
    tone("noise", 0, 0, 0.25, 0.15),
    tone("sawtooth", 300, 900, 0.25, 0.18),
  ],
  flap: [tone("sine", 500, 900, 0.07, 0.18)],
  grow: [
    tone("triangle", 392, 392, 0.08, 0.25),
    tone("triangle", 523, 523, 0.08, 0.25, 0.08),
    tone("triangle", 784, 784, 0.18, 0.25, 0.16),
  ],
  levelup: [
    tone("square", 523, 523, 0.08, 0.25),
    tone("square", 659, 659, 0.08, 0.25, 0.08),
    tone("square", 784, 784, 0.08, 0.25, 0.16),
    tone("square", 1047, 1047, 0.25, 0.25, 0.24),
  ],
  pack: [
    tone("sine", 880, 880, 0.06, 0.22),
    tone("sine", 1175, 1175, 0.12, 0.22, 0.06),
  ],
  secret: [
    tone("sine", 784, 784, 0.08, 0.25),
    tone("sine", 988, 988, 0.08, 0.25, 0.08),
    tone("sine", 1319, 1319, 0.2, 0.25, 0.16),
  ],
  shield: [
    tone("sine", 300, 1200, 0.25, 0.22),
    tone("triangle", 1200, 1600, 0.2, 0.15, 0.1),
  ],
  shrink: [tone("triangle", 880, 220, 0.3, 0.25)],
  spring: [tone("sine", 220, 880, 0.18, 0.3)],
  whoosh: [tone("noise", 0, 0, 0.3, 0.15), tone("sine", 1200, 300, 0.3, 0.15)],
  wings: [
    tone("triangle", 660, 990, 0.1, 0.25),
    tone("triangle", 990, 1320, 0.15, 0.25, 0.1),
  ],
} as const satisfies Record<string, Effect>;
