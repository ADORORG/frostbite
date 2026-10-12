import {
  attachGameHost,
  createGameHost,
  type HostedGame,
} from "@ador/game-sdk/host";
import {
  createLocalBackend,
  type KeyValueStorage,
} from "@ador/game-sdk/local-backend";
import {
  createSyncedBackend,
  type AccountPort,
  type SyncStatus,
} from "@ador/game-sdk/synced-backend";
import { useEffect, useEffectEvent, useState, type RefObject } from "react";

import { createAccountPort } from "../client/account-sync.ts";

// How long a "milestone reached" notice stays up.
export const toastMs = 6_000;

export interface UnlockedMilestones {
  readonly [id: string]: string;
}

// The browser's own storage, or a stand-in that lasts only as long as the page when the browser refuses it
// (a blocked-storage setting), so the game still plays and the player is told nothing will be kept.
function browserStorage(): {
  readonly kept: boolean;
  readonly storage: KeyValueStorage;
} {
  try {
    const { localStorage } = window;
    localStorage.getItem("ador:probe");
    return { kept: true, storage: localStorage };
  } catch {
    const memory = new Map<string, string>();
    return {
      kept: false,
      storage: {
        getItem: (key) => memory.get(key) ?? null,
        setItem: (key, value) => void memory.set(key, value),
      },
    };
  }
}

// Connects the game running in `frame` to the platform, then starts it: the page, not the game, owns the player's storage. The
// game is identified by the window the message came from, because a sandboxed frame has no origin to check.
export function useGameSession(
  game: HostedGame,
  frame: RefObject<HTMLIFrameElement | null>,
  src: string,
  accountFor: (gameId: string) => AccountPort = createAccountPort,
) {
  const [unlocked, setUnlocked] = useState<UnlockedMilestones>({});
  const [connected, setConnected] = useState(false);
  const [kept, setKept] = useState(true);
  const [sync, setSync] = useState<SyncStatus>("local");
  const [toast, setToast] = useState<string | null>(null);
  const { id, milestones } = game;
  // The account is looked up when the session starts, not whenever the function that finds it is a new one: a
  // session restarted by a re-render would reload the game and lose what the player was doing.
  const remoteFor = useEffectEvent((gameId: string) => accountFor(gameId));

  useEffect(() => {
    const element = frame.current;
    const target = element?.contentWindow;
    if (element === null || target === null || target === undefined) return;
    const session = browserStorage();
    const local = createLocalBackend({
      gameId: id,
      storage: session.storage,
    });
    // The browser keeps the copy the game uses; the account is synced behind it when someone is signed in.
    const backend = createSyncedBackend({
      local,
      onStatus: setSync,
      remote: remoteFor(id),
    });
    // A milestone is announced when it is reported while the player is here, never for those they already had.
    const seen = new Set<string>();
    let baselined = false;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    const announce = (ids: readonly string[]) => {
      clearTimeout(toastTimer);
      const titles = ids.map(
        (found) =>
          milestones.find((milestone) => milestone.id === found)?.title ??
          found,
      );
      setToast(`${titles.join(", ")} reached`);
      toastTimer = setTimeout(() => setToast(null), toastMs);
    };
    const refresh = () =>
      void backend.milestones().then((records) => {
        const fresh = Object.keys(records).filter((key) => !seen.has(key));
        for (const key of fresh) seen.add(key);
        if (baselined && fresh.length > 0) announce(fresh);
        baselined = true;
        setKept(session.kept);
        setUnlocked(
          Object.fromEntries(
            Object.entries(records).map(([key, { unlockedAt }]) => [
              key,
              unlockedAt,
            ]),
          ),
        );
      });
    refresh();
    const host = createGameHost({
      backend,
      game: { id, milestones },
      onEvent: (event) => {
        if (event.type === "ready") setConnected(true);
        if (event.type === "milestone-unlocked") refresh();
      },
      // The frame has no origin of its own, so the only address a message to it can name is "*". It carries
      // only this game's own data, and goes to the one window the page created.
      reply: (message) => target.postMessage(message, "*"),
    });
    const detach = attachGameHost({ frame: target, host, listenOn: window });
    // The game is started only now, so the host is already listening when it first speaks. Started any
    // earlier (by the markup the server sent) its opening message could arrive before the page is ready, and
    // be lost.
    element.setAttribute("src", src);
    return () => {
      clearTimeout(toastTimer);
      detach();
    };
  }, [frame, id, milestones, src]);

  return { connected, kept, sync, toast, unlocked };
}
