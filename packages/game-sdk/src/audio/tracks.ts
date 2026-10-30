// A piece of music as data: a tempo and a few voices, each a short loop of notes (a MIDI note number, or null for a rest). Voices
// loop on their own length, so a bass of eight steps under a tune of thirty-two makes one long piece out of small parts. Nothing
// here makes a sound; `stepsAt` says which notes begin on a given step, and the engine plays them.
export type Wave = "sawtooth" | "sine" | "square" | "triangle";

export interface Voice {
  readonly gain: number;
  // How many steps a note is held before it is released.
  readonly hold: number;
  readonly notes: readonly (number | null)[];
  readonly wave: Wave;
}

export interface Track {
  readonly name: string;
  // Steps are eighth notes: `tempo` is beats (quarter notes) a minute.
  readonly tempo: number;
  readonly voices: readonly Voice[];
}

export interface Note {
  readonly gain: number;
  readonly hold: number;
  readonly midi: number;
  readonly wave: Wave;
}

const stepsPerBeat = 2;

export const stepSeconds = (tempo: number): number =>
  60 / (tempo * stepsPerBeat);

// A note's pitch in hertz (A4 = 69 = 440).
export const frequency = (midi: number): number =>
  440 * 2 ** ((midi - 69) / 12);

export function stepsAt(track: Track, step: number): readonly Note[] {
  return track.voices.flatMap((voice) => {
    const midi = voice.notes[step % voice.notes.length];
    return midi === null || midi === undefined
      ? []
      : [{ gain: voice.gain, hold: voice.hold, midi, wave: voice.wave }];
  });
}
