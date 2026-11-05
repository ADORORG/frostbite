import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Effect } from "@frostbite/game-sdk/audio/effects";
import { setUpSound, type GameSound } from "@frostbite/game-sdk/audio/setup";
import type { SoundSettings } from "@frostbite/game-sdk/audio/settings";
import type { Track } from "@frostbite/game-sdk/audio/tracks";
import { createPause, type Pause } from "@frostbite/game-sdk/pause";

import { soundKey } from "../platform/storage-keys.ts";

// A cabinet's music, effects and sound panel, for as long as it is open. The sound settings are kept in the game's own storage (the
// platform saves it), under one key for all the cabinets: the player chose them once.
export interface CabinetSound<Name extends string> {
  // Where the panel goes; the cabinet puts an element here, in its foot.
  readonly container: React.RefObject<HTMLDivElement | null>;
  // Music on or off for a run. Stable, so a timer that outlives a render can use it.
  readonly music: (playing: boolean) => void;
  readonly pause: Pause;
  readonly paused: boolean;
  readonly sfx: (name: Name) => void;
}

function saved(): unknown {
  try {
    return JSON.parse(localStorage.getItem(soundKey) ?? "null");
  } catch {
    return null;
  }
}

function save(settings: SoundSettings): void {
  try {
    localStorage.setItem(soundKey, JSON.stringify(settings));
  } catch {
    // A full or refused storage only means the choice is not kept.
  }
}

export function useCabinetSound<Name extends string>(
  open: boolean,
  track: Track,
  effects: Readonly<Record<Name, Effect>>,
): CabinetSound<Name> {
  const container = useRef<HTMLDivElement>(null);
  const pause = useMemo(createPause, []);
  const game = useRef<GameSound<Name> | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => pause.subscribe(setPaused), [pause]);
  useEffect(() => {
    if (!open || container.current === null) return;
    const made = setUpSound({
      container: container.current,
      effects,
      pause,
      save,
      track,
    });
    made.apply(saved());
    game.current = made;
    return () => {
      made.close();
      pause.set(false);
      game.current = null;
    };
  }, [open, track, effects, pause]);
  const music = useCallback(
    (playing: boolean) => game.current?.music(playing),
    [],
  );
  const sfx = useCallback((name: Name) => game.current?.sfx(name), []);
  return { container, music, pause, paused, sfx };
}
