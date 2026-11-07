import type { GameHost } from "@frostbite/game-sdk/host";
import { forwardPageKeys } from "@frostbite/game-sdk/host-keys";
import { useEffect, type RefObject } from "react";

// Gives a connected game the keys the player presses before clicking into it, without moving focus into its frame (which would take the
// first Tab from the page's skip link). The page tells the game with `key.forwarded`, and the game's client plays it back as the key
// event the game listens for. Once the page has handed a scrolling key to the game, the page does not scroll with it.
export function useKeyForwarding(
  host: RefObject<GameHost | null>,
  connected: boolean,
): void {
  useEffect(() => {
    if (!connected) return undefined;
    return forwardPageKeys(document, (key) =>
      host.current?.emit("key.forwarded", key),
    );
  }, [connected, host]);
}
