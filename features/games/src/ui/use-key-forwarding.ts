import type { GameHost } from "@frostbite/game-sdk/host";
import { useEffect, type RefObject } from "react";

import { forwardedKeyOf, scrollingKey } from "./key-forwarding.ts";

// Gives a connected game the keys the player presses before clicking into it, without moving focus into its frame (which would take the
// first Tab from the page's skip link). The page tells the game with `key.forwarded`, and the game's client plays it back as the key
// event the game listens for. Once the page has handed a scrolling key to the game, the page does not scroll with it.
export function useKeyForwarding(
  host: RefObject<GameHost | null>,
  connected: boolean,
): void {
  useEffect(() => {
    if (!connected) return undefined;
    const forward = (event: KeyboardEvent) => {
      const key = forwardedKeyOf(event, document.activeElement);
      if (key === null) return;
      host.current?.emit("key.forwarded", key);
      if (scrollingKey.test(key.code)) event.preventDefault();
    };
    document.addEventListener("keydown", forward);
    document.addEventListener("keyup", forward);
    return () => {
      document.removeEventListener("keydown", forward);
      document.removeEventListener("keyup", forward);
    };
  }, [connected, host]);
}
