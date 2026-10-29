"use client";

import { useRef, useSyncExternalStore } from "react";

import type { Scene } from "../engine/index.ts";
import { useScenes } from "./scenes-provider.tsx";

const never = () => () => undefined;

// The scene a backdrop shows: the one named, or one taken at random once per backdrop and kept. On the server, and in the first render
// of the browser, there is none, so the markup matches what the server sent; the choice arrives right after, with no flash.
export function useChosenScene(sceneId: string | undefined): Scene | null {
  const { claimRandom, scenes } = useScenes();
  const chosen = useRef<Scene | null>(null);
  return useSyncExternalStore(
    never,
    () => {
      chosen.current ??=
        scenes.find(({ id }) => id === sceneId) ?? claimRandom();
      return chosen.current;
    },
    () => null,
  );
}
