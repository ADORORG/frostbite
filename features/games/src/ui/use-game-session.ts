import {
  attachGameHost,
  createGameHost,
  type HostedGame,
} from "@ador/game-sdk/host";
import {
  createLocalBackend,
  type KeyValueStorage,
} from "@ador/game-sdk/local-backend";
import { useEffect, useState, type RefObject } from "react";

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
) {
  const [unlocked, setUnlocked] = useState<UnlockedMilestones>({});
  const [connected, setConnected] = useState(false);
  const [kept, setKept] = useState(true);
  const { id, milestones } = game;

  useEffect(() => {
    const element = frame.current;
    const target = element?.contentWindow;
    if (element === null || target === null || target === undefined) return;
    const session = browserStorage();
    const backend = createLocalBackend({
      gameId: id,
      storage: session.storage,
    });
    const refresh = () =>
      void backend.milestones().then((records) => {
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
    return detach;
  }, [frame, id, milestones, src]);

  return { connected, kept, unlocked };
}
