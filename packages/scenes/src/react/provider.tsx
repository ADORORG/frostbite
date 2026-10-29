"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  createPreference,
  createScheduler,
  pickRandom,
  playbackFor,
  playbackLimits,
  type Playback,
  type Scene,
  type Scheduler,
  type UserChoice,
} from "../engine/index.ts";
import { scenes as registered } from "../library/index.ts";
import { browserEnvironment } from "./browser.ts";
import {
  canvasSupported,
  createChoiceStore,
  deviceFrom,
  devicePending,
  deviceSnapshot,
  subscribeToDevice,
} from "./browser-stores.ts";

interface ScenesContext {
  // Whether this browser can draw a scene itself. On the server, and until it is asked, yes.
  readonly canvas: boolean;
  // Takes a scene at random that no other backdrop on the page has taken, while there are unused ones.
  readonly claimRandom: () => Scene;
  readonly choice: UserChoice | null;
  readonly playback: Playback;
  readonly scenes: readonly Scene[];
  readonly scheduler: Scheduler;
  readonly setChoice: (choice: UserChoice) => void;
  // Where the app serves each scene's video files (see `videoFiles`), or nothing when it does not serve them.
  readonly videoBase: string | null;
}

const never = () => () => undefined;

const Context = createContext<ScenesContext | null>(null);

export function useScenes(): ScenesContext {
  const value = useContext(Context);
  if (value === null)
    throw new Error("Scenes are used inside a ScenesProvider.");
  return value;
}

// Put once at the top of the app. It owns the one frame loop for every scene below it, and works out whether they move: what the device
// asks for (less motion, less data), then the person's own remembered choice. Until the browser has been asked, nothing moves, so the
// first paint matches what the server sent.
export function ScenesProvider({
  children,
  list = registered,
  videoBase = null,
}: {
  readonly children: ReactNode;
  readonly list?: readonly Scene[];
  readonly videoBase?: string | null;
}) {
  const scheduler = useMemo(
    () =>
      createScheduler(browserEnvironment, {
        cap: playbackLimits.maxRunning,
        rankEveryMs: playbackLimits.rankEveryMs,
      }),
    [],
  );
  const preference = useMemo(
    () =>
      createPreference(
        typeof localStorage === "undefined" ? null : localStorage,
      ),
    [],
  );
  const choiceStore = useMemo(
    () => createChoiceStore(preference),
    [preference],
  );
  const choice = useSyncExternalStore(
    choiceStore.subscribe,
    choiceStore.read,
    () => null,
  );
  const device = deviceFrom(
    useSyncExternalStore(
      subscribeToDevice,
      deviceSnapshot,
      () => devicePending,
    ),
  );
  const taken = useRef<number[]>([]);
  const canvasProbe = useRef<boolean | null>(null);
  const canvas = useSyncExternalStore(
    never,
    () => (canvasProbe.current ??= canvasSupported()),
    () => true,
  );

  const playback: Playback =
    device === null ? "still" : playbackFor(device, choice);

  useEffect(() => {
    scheduler.setPlayback(playback);
  }, [playback, scheduler]);
  useEffect(() => {
    scheduler.start();
    return () => scheduler.stop();
  }, [scheduler]);

  const value = useMemo<ScenesContext>(
    () => ({
      canvas,
      choice,
      claimRandom: () => {
        const at = pickRandom(list.length, taken.current);
        taken.current.push(at);
        const scene = list[at];
        if (scene === undefined) throw new Error("There are no scenes.");
        return scene;
      },
      playback,
      scenes: list,
      scheduler,
      setChoice: choiceStore.write,
      videoBase,
    }),
    [canvas, choice, choiceStore, list, playback, scheduler, videoBase],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
