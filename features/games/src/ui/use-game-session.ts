import { attachGameHost } from "@frostbite/game-sdk/attach";
import {
  createGameHost,
  type GameHost,
  type HostedGame,
  type ClaimsService,
  type RunsService,
} from "@frostbite/game-sdk/host";
import type {
  VerificationLevel,
  WalletInfo,
} from "@frostbite/game-sdk/protocol";
import type { GameClaimState } from "@frostbite/shared/games";
import {
  createLocalBackend,
  type KeyValueStorage,
} from "@frostbite/game-sdk/local-backend";
import {
  createSyncedBackend,
  type AccountPort,
  type SyncStatus,
} from "@frostbite/game-sdk/synced-backend";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";

import { createAccountPort } from "../client/account-sync.ts";
import { newBestWatcher } from "../domain/best-score.ts";
import { createClaimsService } from "../client/claims-port.ts";
import { createRunsService } from "../client/runs-port.ts";
import { useHostEvents } from "./use-host-events.ts";
import { useKeyForwarding } from "./use-key-forwarding.ts";

// How long a "milestone reached" notice stays up.
export const toastMs = 6_000;

export interface UnlockedMilestones {
  readonly [id: string]: string;
}

// What the player's records say beyond "earned": how many times each milestone has been earned, and the total
// reported toward the target of each that has one.
export interface MilestoneProgress {
  readonly counts: Readonly<Record<string, number>>;
  // How each earned milestone is known: the game's report, or a run the platform replayed.
  readonly levels: Readonly<Record<string, VerificationLevel>>;
  readonly totals: Readonly<Record<string, number>>;
}

const noProgress: MilestoneProgress = { counts: {}, levels: {}, totals: {} };

// The browser's own storage, or a stand-in that lasts only as long as the page when the browser refuses it
// (a blocked-storage setting), so the game still plays and the player is told nothing will be kept.
function browserStorage(): {
  readonly kept: boolean;
  readonly storage: KeyValueStorage;
} {
  try {
    const { localStorage } = window;
    localStorage.getItem("frostbite:probe");
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
  page: {
    readonly connectWallet?: () => void;
    readonly title: string;
    readonly wallet?: WalletInfo | null;
  } = { title: game.id },
  // How the game reaches the platform to start and settle replay-verified runs.
  runsFor: (gameId: string) => RunsService = createRunsService,
  // How the game asks the platform to start a claim of a milestone. The default has nowhere to show the claim to the player yet,
  // so a game is told claims are not supported rather than that one was requested.
  claimsFor: (
    gameId: string,
    wallet: () => WalletInfo | null,
  ) => ClaimsService = (gameId, walletOf) =>
    createClaimsService({ gameId, wallet: walletOf }),
) {
  const [unlocked, setUnlocked] = useState<UnlockedMilestones>({});
  const [progress, setProgress] = useState<MilestoneProgress>(noProgress);
  const [connected, setConnected] = useState(false);
  const [kept, setKept] = useState(true);
  const [sync, setSync] = useState<SyncStatus>("local");
  const [toast, setToast] = useState<string | null>(null);
  // The best score the player has just beaten, kept until they beat it again; none until they do.
  const [newBest, setNewBest] = useState<number | null>(null);
  const { capabilities, id, milestones } = game;
  const { connectWallet, title, wallet } = page;
  // Whether the page can open the chooser at all is fixed for the page; the function itself is read when asked.
  const canConnect = connectWallet !== undefined;
  const host = useRef<GameHost | null>(null);
  // Read when the game asks, so a wallet that connects later is seen without restarting the game.
  const walletNow = useRef(wallet);
  useEffect(() => {
    walletNow.current = wallet;
  }, [wallet]);
  const connectNow = useRef(connectWallet);
  useEffect(() => {
    connectNow.current = connectWallet;
  }, [connectWallet]);
  // The account is looked up when the session starts, not whenever the function that finds it is a new one: a
  // session restarted by a re-render would reload the game and lose what the player was doing.
  const remoteFor = useEffectEvent((gameId: string) => accountFor(gameId));
  const runsOf = useEffectEvent((gameId: string) => runsFor(gameId));
  const claimsOf = useEffectEvent((gameId: string) =>
    claimsFor(gameId, () => walletNow.current ?? null),
  );

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
            levels: Object.fromEntries(
              Object.entries(records).map(([key, { verification }]) => [
                key,
                verification,
              ]),
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
    // The game's best is read from the progress it loads and saves (no game has to say it): a save that beats the one loaded is a new best.
    const watcher = newBestWatcher();
    const watched: typeof backend = {
      ...backend,
      loadProgress: async () => {
        const loaded = await backend.loadProgress();
        watcher.loaded(loaded);
        return loaded;
      },
      saveProgress: async (state, now) => {
        const best = watcher.saved(state);
        if (best !== null) setNewBest(best);
        return backend.saveProgress(state, now);
      },
    };
    const hosted = createGameHost({
      backend: watched,
      game: { capabilities, id, milestones },
      onEvent: (event) => {
        if (event.type === "ready") setConnected(true);
        if (
          event.type === "milestone-unlocked" ||
          event.type === "milestone-counted" ||
          event.type === "milestone-progress" ||
          event.type === "run-verified"
        )
          refresh();
      },
      // The frame has no origin of its own, so the only address a message to it can name is "*". It carries
      // only this game's own data, and goes to the one window the page created.
      push: (message) => target.postMessage(message, "*"),
      reply: (message) => target.postMessage(message, "*"),
      // The game's words are shown as the game's: a message from it must not pass for the platform's.
      services: {
        claims: claimsOf(id),
        runs: runsOf(id),
        toast: (message) => show(`${title}: ${message}`),
        wallet: () => walletNow.current ?? null,
        // Offered only when the page has a way to open the chooser; otherwise the game is told it is unavailable.
        ...(canConnect ? { connectWallet: () => connectNow.current?.() } : {}),
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
  }, [canConnect, capabilities, frame, id, milestones, src, title]);

  useHostEvents(host, frame, wallet);
  useKeyForwarding(host, connected);

  // Tells the game how a claim is going; dropped for a game that did not declare `milestone:claim`.
  const emitClaim = useCallback(
    (milestoneId: string, state: GameClaimState) =>
      host.current?.emit("claim.changed", { id: milestoneId, state }),
    [],
  );
  return {
    connected,
    emitClaim,
    kept,
    newBest,
    progress,
    sync,
    toast,
    unlocked,
  };
}
