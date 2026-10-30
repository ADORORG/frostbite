import { createSound } from "../../src/audio/engine.ts";
import { defaultSound } from "../../src/audio/settings.ts";
import type { Track } from "../../src/audio/tracks.ts";
import { FakeContext, manualTimer } from "../../src/audio/fake.ts";

export const song: Track = {
  name: "song",
  tempo: 120,
  voices: [{ gain: 0.3, hold: 1, notes: [69, null, 81, 69], wave: "square" }],
};

export function setup(settings = defaultSound) {
  const context = new FakeContext();
  const timer = manualTimer();
  const changes: unknown[] = [];
  const sound = createSound({
    context: () => context,
    onChange: (next) => changes.push(next),
    settings,
    timer,
  });
  return { changes, context, sound, timer };
}

export const frequencies = (context: FakeContext) =>
  context.oscillators.map(({ frequency }) => frequency.calls[0]?.[1]);
