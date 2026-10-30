import { seeded } from "../seeded.ts";
import type { BufferLike, ContextLike, GainLike, NodeLike } from "./context.ts";
import type { Effect, Tone } from "./effects.ts";
import { defaultSound, type SoundSettings } from "./settings.ts";
import {
  frequency,
  stepSeconds,
  stepsAt,
  type Note,
  type Track,
} from "./tracks.ts";

// Plays a game's music and effects with the browser's audio, from data, with no sound files. Browsers keep a page silent until the
// player has acted on it, so nothing starts until `unlock` is called from a press or a key; until then (and where there is no audio
// at all) `state()` says so rather than pretending to play.
export interface Timer {
  every(run: () => void, ms: number): () => void;
}

export interface SoundOptions {
  readonly context: () => ContextLike;
  readonly onChange?: (settings: SoundSettings) => void;
  readonly settings?: SoundSettings;
  readonly timer?: Timer;
}

export interface SoundState {
  // The browser has a context and it is running (not blocked, not suspended).
  readonly audible: boolean;
  // The browser has no audio at all, or refused one.
  readonly available: boolean;
  readonly settings: SoundSettings;
  // The player has acted and the browser handed over a context; before that nothing can play.
  readonly unlocked: boolean;
}

// Music is scheduled a little ahead of the clock so a busy page does not make it stutter.
const lookaheadSeconds = 0.15;
const pumpMs = 40;
const musicLevel = 0.5;
const noiseSeconds = 1;
const attackSeconds = 0.01;
const floor = 0.0001;

export const intervalTimer: Timer = {
  every(run, ms) {
    const handle = setInterval(run, ms);
    return () => clearInterval(handle);
  },
};

export function createSound(options: SoundOptions) {
  const timer = options.timer ?? intervalTimer;
  let settings = options.settings ?? defaultSound;
  let context: ContextLike | null = null;
  let failed = false;
  let master: GainLike | null = null;
  let music: GainLike | null = null;
  let effects: GainLike | null = null;
  let noise: BufferLike | null = null;
  let track: Track | null = null;
  let step = 0;
  let nextTime = 0;
  let tempoScale = 1;
  let stopPump: (() => void) | null = null;
  let pausedByGame = false;
  let hidden = false;

  const levels = (): void => {
    if (
      context === null ||
      master === null ||
      music === null ||
      effects === null
    )
      return;
    const now = context.currentTime;
    master.gain.setValueAtTime(settings.volume, now);
    music.gain.setValueAtTime(settings.music ? musicLevel : 0, now);
    effects.gain.setValueAtTime(settings.effects ? 1 : 0, now);
  };

  function oscillator(note: Note, at: number, seconds: number, into: NodeLike) {
    if (context === null) return;
    const voice = context.createOscillator();
    const envelope = context.createGain();
    voice.type = note.wave;
    voice.frequency.setValueAtTime(frequency(note.midi), at);
    envelope.gain.setValueAtTime(floor, at);
    envelope.gain.linearRampToValueAtTime(note.gain, at + attackSeconds);
    envelope.gain.exponentialRampToValueAtTime(floor, at + seconds);
    voice.connect(envelope);
    envelope.connect(into);
    voice.start(at);
    voice.stop(at + seconds + 0.02);
  }

  function pump(): void {
    if (context === null || music === null || track === null) return;
    const seconds = stepSeconds(track.tempo * tempoScale);
    while (nextTime < context.currentTime + lookaheadSeconds) {
      if (settings.music)
        for (const note of stepsAt(track, step))
          oscillator(note, nextTime, note.hold * seconds, music);
      step += 1;
      nextTime += seconds;
    }
  }

  function noiseBuffer() {
    if (context === null) return null;
    if (noise !== null) return noise;
    const length = Math.floor(context.sampleRate * noiseSeconds);
    const made = context.createBuffer(1, length, context.sampleRate);
    const random = seeded(1);
    const data = made.getChannelData(0);
    for (let at = 0; at < length; at += 1) data[at] = random() * 2 - 1;
    noise = made;
    return made;
  }

  function play(part: Tone, base: number, into: NodeLike): void {
    if (context === null) return;
    const at = base + part.at;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(part.gain, at);
    envelope.gain.exponentialRampToValueAtTime(floor, at + part.seconds);
    envelope.connect(into);
    if (part.wave === "noise") {
      const source = context.createBufferSource();
      source.buffer = noiseBuffer();
      source.loop = true;
      source.connect(envelope);
      source.start(at);
      source.stop(at + part.seconds + 0.02);
      return;
    }
    const voice = context.createOscillator();
    voice.type = part.wave;
    voice.frequency.setValueAtTime(part.from, at);
    voice.frequency.exponentialRampToValueAtTime(part.to, at + part.seconds);
    voice.connect(envelope);
    voice.start(at);
    voice.stop(at + part.seconds + 0.02);
  }

  function settle(): void {
    if (context === null) return;
    const wanted = pausedByGame || hidden;
    if (wanted && context.state === "running") void context.suspend();
    if (!wanted && context.state === "suspended") void context.resume();
  }

  async function unlock(): Promise<void> {
    if (failed) return;
    try {
      if (context === null) {
        const made = options.context();
        master = made.createGain();
        music = made.createGain();
        effects = made.createGain();
        music.connect(master);
        effects.connect(master);
        master.connect(made.destination);
        context = made;
        levels();
        if (track !== null) nextTime = made.currentTime + 0.05;
        stopPump ??= timer.every(pump, pumpMs);
      }
      if (context.state === "suspended" && !pausedByGame && !hidden)
        await context.resume();
    } catch {
      failed = true;
      context = null;
    }
  }

  return {
    // Stops the timer that feeds the music; the sound is not used again after this.
    close(): void {
      stopPump?.();
      stopPump = null;
      track = null;
    },
    configure(next: Partial<SoundSettings>): SoundSettings {
      settings = { ...settings, ...next };
      levels();
      options.onChange?.(settings);
      return settings;
    },
    effect(effect: Effect): void {
      if (context === null || effects === null || !settings.effects) return;
      if (pausedByGame || hidden) return;
      const base = context.currentTime;
      for (const part of effect) play(part, base, effects);
    },
    pause(): void {
      pausedByGame = true;
      settle();
    },
    playMusic(next: Track): void {
      if (track?.name === next.name) return;
      track = next;
      step = 0;
      nextTime = context === null ? 0 : context.currentTime + 0.05;
      pump();
    },
    resume(): void {
      pausedByGame = false;
      settle();
    },
    setHidden(value: boolean): void {
      hidden = value;
      settle();
    },
    // The music runs faster or slower as the game does: 1 is the track's own tempo.
    setTempoScale(scale: number): void {
      tempoScale = Math.max(0.25, scale);
    },
    state(): SoundState {
      return {
        audible: context !== null && context.state === "running",
        available: !failed,
        settings,
        unlocked: context !== null,
      };
    },
    stopMusic(): void {
      track = null;
    },
    unlock,
  };
}

export type Sound = ReturnType<typeof createSound>;

// Silence the page's sound while its tab is out of sight.
export function followVisibility(
  sound: Pick<Sound, "setHidden">,
  page: {
    addEventListener(type: "visibilitychange", listener: () => void): void;
    readonly hidden: boolean;
  },
): void {
  page.addEventListener("visibilitychange", () => sound.setHidden(page.hidden));
}
