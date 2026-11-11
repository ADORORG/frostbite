import { heatLevels } from "@frostbite/shared/games";

// What the pages say about how hot a game is. The words climb with the meter, so a bar and a word always agree.
const stages = [
  "Warming up",
  "Warm",
  "Heating up",
  "Hot",
  "Blazing",
] as const satisfies readonly string[] & { readonly length: typeof heatLevels };

export const heatCopy: {
  readonly describe: (heat: number) => string;
  readonly hot: string;
  readonly rail: { readonly summary: string; readonly title: string };
  readonly stage: (heat: number) => string;
} = {
  // The sticker on a hot game's cover.
  hot: "Hot",
  // What the meter says for a heat, to the eye and to a screen reader.
  stage: (heat: number): string =>
    stages[Math.min(Math.max(heat, 1), heatLevels) - 1] ?? stages[0],
  // The same, with the level, for someone who cannot see the bars.
  describe: (heat: number): string =>
    `${heatCopy.stage(heat)}, ${String(heat)} of ${String(heatLevels)}`,
  // The rail on the landing page, when something is hot, and when nothing is.
  rail: {
    summary: "The games being played the most this week.",
    title: "Hot right now",
  },
} as const;
