import { attachGameHost } from "@ador/game-sdk/attach";
import {
  createGameHost,
  type GameHost,
  type HostedGame,
} from "@ador/game-sdk/host";
import type { WalletInfo } from "@ador/game-sdk/protocol";
import {
  createLocalBackend,
  type KeyValueStorage,
} from "@ador/game-sdk/local-backend";
import {
  createSyncedBackend,
  type AccountPort,
  type SyncStatus,
} from "@ador/game-sdk/synced-backend";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";

import { createAccountPort } from "../client/account-sync.ts";
import { useHostEvents } from "./use-host-events.ts";

// How long a "milestone reached" notice stays up.
export const toastMs = 6_000;

export interface UnlockedMilestones {
  readonly [id: string]: string;
}

// What the player's records say beyond "earned": how many times each milestone has been earned, and the total
// reported toward the target of each that has one.
export interface MilestoneProgress {
  readonly counts: Readonly<Record<string, number>>;
  readonly totals: Readonly<Record<string, number>>;
}

const noProgress: MilestoneProgress = { counts: {}, totals: {} };

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
  // `title` names the game on a message it asks the page to show. `wallet` is what the player has connected;
  // undefined for a game that cannot see a wallet at all.
  page: { readonly title: string; readonly wallet?: WalletInfo | null } = {
    title: game.id,
  },
) {
  const [unlocked, setUnlocked] = useState<UnlockedMilestones>({});
  const [progress, setProgress] = useState<MilestoneProgress>(noProgress);
  const [connected, setConnected] = useState(false);
  const [kept, setKept] = useState(true);
  const [sync, setSync] = useState<SyncStatus>("local");
  const [toast, setToast] = useState<string | null>(null);
  const { capabilities, id, milestones } = game;
  const { title, wallet } = page;
  const host = useRef<GameHost | null>(null);
  // Read when the game asks, so a wallet that connects later is seen without restarting the game.
  const walletNow = useRef(wallet);
  useEffect(() => {
    walletNow.current = wallet;
  }, [wallet]);
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
    // Told to the game when sign-in replaces this browser's id with the account's; the host drops it for a game
    // that has not said ready, and such a game asks and is answered with the account's id.
    const backend = createSyncedBackend({
      local,
      onIdentity: (identity) => host.current?.emit("player.changed", identity),
      onStatus: setSync,
      remote: remoteFor(id),
    });
    // A milestone is announced when it is reported while the player is here, never for those they already had: when
    // it is newly earned, and again, with its count, each time a repeatable one is counted.
    const seen = new Map<string, number>();
    let baselined = false;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    const show = (text: string) => {
      clearTimeout(toastTimer);
      setToast(text);
      toastTimer = setTimeout(() => setToast(null), toastMs);
    };
    const titleOf = (found: string) =>
      milestones.find((milestone) => milestone.id === found)?.title ?? found;
    const refresh = () =>
      void Promise.all([backend.milestones(), backend.counters()]).then(
        ([records, totals]) => {
          const reached = Object.entries(records)
            .filter(([key, { count }]) => count > (seen.get(key) ?? 0))
            .map(([key, { count }]) => {
              const first = !seen.has(key);
              seen.set(key, count);
              return first || count === 1
                ? `${titleOf(key)} reached`
                : `${titleOf(key)} reached (x${String(count)})`;
            });
          if (baselined && reached.length > 0) show(reached.join(", "));
          baselined = true;
          setKept(session.kept);
          setProgress({
            counts: Object.fromEntries(
              Object.entries(records).map(([key, { count }]) => [key, count]),
            ),
            totals,
          });
          setUnlocked(
            Object.fromEntries(
              Object.entries(records).map(([key, { unlockedAt }]) => [
                key,
                unlockedAt,
              ]),
            ),
          );
        },
      );
    refresh();
    const hosted = createGameHost({
      backend,
      game: { capabilities, id, milestones },
      onEvent: (event) => {
        if (event.type === "ready") setConnected(true);
        if (
          event.type === "milestone-unlocked" ||
          event.type === "milestone-counted" ||
          event.type === "milestone-progress"
        )
          refresh();
      },
      // The frame has no origin of its own, so the only address a message to it can name is "*". It carries
      // only this game's own data, and goes to the one window the page created.
      push: (message) => target.postMessage(message, "*"),
      reply: (message) => target.postMessage(message, "*"),
      // The game's words are shown as the game's: a message from it must not pass for the platform's.
      services: {
        toast: (message) => show(`${title}: ${message}`),
        wallet: () => walletNow.current ?? null,
      },
    });
    host.current = hosted;
    const detach = attachGameHost({
      frame: target,
      host: hosted,
      listenOn: window,
    });
    // The game is started only now, so the host is already listening when it first speaks. Started any
    // earlier (by the markup the server sent) its opening message could arrive before the page is ready, and
    // be lost.
    element.setAttribute("src", src);
    return () => {
      clearTimeout(toastTimer);
      host.current = null;
      detach();
    };
  }, [capabilities, frame, id, milestones, src, title]);

  useHostEvents(host, frame, wallet);

  return { connected, kept, progress, sync, toast, unlocked };
}
