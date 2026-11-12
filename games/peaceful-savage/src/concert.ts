import { type Effect, tone } from "@frostbite/game-sdk/audio/effects";

// The show's music: a warm twelve-second groove at a hundred beats a minute, played five times through the show. Five bars of drums
// (a deep drum on one and three, a snare on two and four, a light tick on every half), a walking bass, soft chords, and a sung tune in
// a pentatonic key that the family sings to. Like the rest of the game's sound, it is only data.
const beat = 0.6;
// The chords' roots, a bar each (A, F, C, G, A), in hertz.
const roots = [110, 87.31, 130.81, 98, 110];
// The tune, an eighth at a time, a bar of eight to a line (0 for a rest): in A minor pentatonic.
const tune = [
  [659.25, 0, 587.33, 523.25, 440, 0, 523.25, 587.33],
  [523.25, 0, 440, 0, 392, 0, 440, 0],
  [659.25, 0, 783.99, 659.25, 587.33, 0, 523.25, 587.33],
  [659.25, 0, 587.33, 0, 523.25, 0, 440, 0],
  [440, 0, 0, 0, 0, 0, 0, 0],
];

const bar = (index: number, root: number): Effect => {
  const start = index * 4 * beat;
  const third = root * (index === 1 || index === 2 ? 1.26 : 1.19);
  return [
    // The chord, held through the bar.
    ...[root * 2, third * 2, root * 3].map((pitch) =>
      tone("sine", pitch, pitch, 4 * beat - 0.1, 0.045, start),
    ),
    // The bass, on one, three and the half before four.
    ...[0, 2, 3.5].flatMap((at) => [
      tone("triangle", root, root, 0.42, 0.3, start + at * beat),
      tone("sine", root / 2, root / 2, 0.5, 0.22, start + at * beat),
    ]),
    // The drums.
    ...[0, 2].map((at) => tone("sine", 130, 45, 0.3, 0.55, start + at * beat)),
    ...[1, 3].map((at) =>
      tone("triangle", 260, 160, 0.14, 0.22, start + at * beat),
    ),
    ...Array.from({ length: 8 }, (_, at) =>
      tone("triangle", 7000, 6500, 0.03, 0.035, start + (at * beat) / 2),
    ),
    // The tune.
    ...(tune[index] ?? []).flatMap((pitch, at) =>
      pitch === 0
        ? []
        : [
            tone(
              "sine",
              pitch,
              pitch * 1.003,
              0.28,
              0.15,
              start + (at * beat) / 2,
            ),
            tone("triangle", pitch, pitch, 0.2, 0.045, start + (at * beat) / 2),
          ],
    ),
  ];
};

export const concert: Effect = roots.flatMap((root, index) => bar(index, root));
