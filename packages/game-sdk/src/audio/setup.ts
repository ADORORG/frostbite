import type { Pause } from "../pause.ts";
import type { Effect } from "./effects.ts";
import { createSound, followVisibility, type Sound } from "./engine.ts";
import { mountSoundPanel } from "./panel.ts";
import { parseSound, type SoundSettings } from "./settings.ts";
import type { Track } from "./tracks.ts";

// What every game does to have sound, in one call: make the sound, put the panel in its place, silence a hidden tab and a paused game,
// and hand back the few things a game uses while it plays. The settings come back from the game's save with `apply`, and go out to
// it through `save` whenever the player changes them.
export interface GameSoundOptions<Name extends string> {
  readonly container: HTMLElement;
  readonly effects: Readonly<Record<Name, Effect>>;
  readonly pause: Pause;
  readonly save: (settings: SoundSettings) => void;
  readonly track: Track;
}

export interface GameSound<Name extends string> {
  // Takes the settings the game read back from its save.
  readonly apply: (saved: unknown) => void;
  readonly music: (playing: boolean) => void;
  // An effect made on the spot, for one that depends on the moment (a pitch that follows the score).
  readonly play: (effect: Effect) => void;
  // A sound effect by the game's own name for it.
  readonly sfx: (name: Name) => void;
  readonly sound: Sound;
  readonly tempo: (scale: number) => void;
}

export function setUpSound<Name extends string>(
  options: GameSoundOptions<Name>,
): GameSound<Name> {
  const sound = createSound({
    context: () => new AudioContext(),
    onChange: options.save,
  });
  followVisibility(sound, document);
  const panel = mountSoundPanel(options.container, sound);
  options.pause.subscribe((paused) => {
    if (paused) sound.pause();
    else sound.resume();
  });
  return {
    apply(saved) {
      sound.configure(parseSound(saved), false);
      panel.refresh();
    },
    music(playing) {
      if (playing) sound.playMusic(options.track);
      else sound.stopMusic();
    },
    play: (effect) => sound.effect(effect),
    sfx: (name) => sound.effect(options.effects[name]),
    sound,
    tempo: (scale) => sound.setTempoScale(scale),
  };
}
