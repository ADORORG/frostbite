import type { GameHost } from "@frostbite/game-sdk/host";
import type { WalletInfo } from "@frostbite/game-sdk/protocol";
import { useEffect, type RefObject } from "react";

// Tells the game what happens around it: the wallet connecting or leaving, the tab being hidden or shown, and
// full screen starting or ending. The host drops an event the game cannot have yet (before `ready`) or may not
// have (a wallet event for a game that did not declare it), so these only report what the page sees.
export function useHostEvents(
  host: RefObject<GameHost | null>,
  frame: RefObject<HTMLIFrameElement | null>,
  wallet: WalletInfo | null | undefined,
): void {
  useEffect(() => {
    if (wallet !== undefined) host.current?.emit("wallet.changed", { wallet });
  }, [host, wallet]);

  useEffect(() => {
    const changed = () =>
      host.current?.emit("lifecycle.changed", {
        state: document.hidden ? "paused" : "active",
      });
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, [host]);

  useEffect(() => {
    const changed = () =>
      host.current?.emit("fullscreen.changed", {
        active:
          document.fullscreenElement !== null &&
          document.fullscreenElement === frame.current,
      });
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, [frame, host]);
}
