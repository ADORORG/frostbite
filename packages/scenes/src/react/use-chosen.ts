"use client";

import { useRef, useSyncExternalStore } from "react";

import type { Scene } from "../engine/index.ts";
import { useScenes } from "./provider.tsx";

const never = () => () => undefined;

// The scene a backdrop shows: the one named (which can change), or one taken at random once and kept. On the server, and in the first
// render of the browser, there is none, so the markup matches what the server sent; the choice arrives right after, with no flash.
export function useChosenScene(sceneId: string | undefined): Scene | null {
  const { claimRandom, scenes } = useScenes();
  const random = useRef<Scene | null>(null);
  return useSyncExternalStore(
    never,
    () => {
      const named = scenes.find(({ id }) => id === sceneId);
      if (named !== undefined) return named;
      random.current ??= claimRandom();
      return random.current;
    },
    () => null,
  );
}
