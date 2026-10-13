import { describe, expect, it, vi } from "vitest";

import {
  createLocalBackend,
  type LocalSnapshot,
} from "../src/local-backend.ts";
import {
  createSyncedBackend,
  type AccountPort,
  type AccountSyncResult,
} from "../src/synced-backend.ts";

const at = new Date("2026-10-12T10:00:00.000Z");
const empty: LocalSnapshot = { milestones: [], progress: null };
const remoteState: LocalSnapshot = {
  milestones: [
    {
      id: "ten-taps",
      unlockedAt: "2026-10-01T00:00:00.000Z",
      verification: "self-reported",
    },
  ],
  progress: { savedAt: "2026-10-02T00:00:00.000Z", state: { taps: 10 } },
};

const accountPlayer = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";

function setup(
  answer: (state: LocalSnapshot) => Promise<AccountSyncResult> = async () => ({
    kind: "synced",
    playerId: accountPlayer,
    state: remoteState,
  }),
) {
  const map = new Map<string, string>();
  const local = createLocalBackend({
    gameId: "g",
    storage: {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
    },
  });
  const sync = vi.fn<AccountPort["sync"]>(answer);
  const statuses: string[] = [];
  const backend = createSyncedBackend({
    local,
    onStatus: (s) => statuses.push(s),
    remote: { sync },
  });
  return { backend, local, statuses, sync };
}

describe("the backend that syncs with the account", () => {
  it("gives the game the merged state before its first read", async () => {
    const { backend, statuses } = setup();
    expect(await backend.loadProgress()).toEqual({ taps: 10 });
    expect(Object.keys(await backend.milestones())).toEqual(["ten-taps"]);
    expect(backend.status()).toBe("account");
    expect(statuses).toEqual(["account"]);
    expect(backend.player().signedIn).toBe(true);
  });

  it("sends what the browser held, to be merged", async () => {
    const map = new Map<string, string>();
    map.set("ador:game:g:progress", "5");
    map.set("ador:game:g:progress-at", JSON.stringify(at.toISOString()));
    const sync = vi.fn<AccountPort["sync"]>(async () => ({
      kind: "synced",
      playerId: accountPlayer,
      state: empty,
    }));
    createSyncedBackend({
      local: createLocalBackend({
        gameId: "g",
        storage: {
          getItem: (k) => map.get(k) ?? null,
          setItem: (k, v) => void map.set(k, v),
        },
      }),
      remote: { sync },
    });
    expect(sync).toHaveBeenCalledWith({
      milestones: [],
      progress: { savedAt: at.toISOString(), state: 5 },
    });
  });

  it("stays local and stops asking once the account says nobody is signed in", async () => {
    const { backend, statuses, sync } = setup(async () => ({
      kind: "signed-out",
    }));
    expect(await backend.loadProgress()).toBeNull();
    await backend.saveProgress({ taps: 1 }, at);
    await backend.unlock("first-five", at);
    await Promise.resolve();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(backend.status()).toBe("local");
    expect(backend.player().signedIn).toBe(false);
    expect(statuses).toEqual([]);
    expect(await backend.loadProgress()).toEqual({ taps: 1 });
  });

  it("sends the whole local state after a save and after an unlock", async () => {
    const { backend, sync } = setup();
    await backend.loadProgress();
    await backend.saveProgress({ taps: 11 }, at);
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    expect(sync.mock.calls[1]?.[0].progress).toEqual({
      savedAt: at.toISOString(),
      state: { taps: 11 },
    });
    const unlocked = await backend.unlock("first-five", at);
    expect(unlocked).toEqual({
      alreadyUnlocked: false,
      unlockedAt: at.toISOString(),
    });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(3));
    expect(sync.mock.calls[2]?.[0].milestones.map(({ id }) => id)).toEqual([
      "ten-taps",
      "first-five",
    ]);
  });

  it("is pending after a failed sync, keeps the game working, and sends again with the next change", async () => {
    let fail = true;
    const { backend, sync } = setup(async () =>
      fail
        ? { kind: "failed" }
        : { kind: "synced", playerId: accountPlayer, state: remoteState },
    );
    expect(await backend.loadProgress()).toBeNull();
    expect(backend.status()).toBe("pending");
    expect(backend.player().signedIn).toBe(true);
    fail = false;
    await backend.saveProgress({ taps: 2 }, at);
    await vi.waitFor(() => expect(backend.status()).toBe("account"));
    expect(sync).toHaveBeenCalledTimes(2);
    // Sent after the failure, the state was never dropped: the account is sent the local state.
    expect(sync.mock.calls[1]?.[0].progress?.state).toEqual({ taps: 2 });
  });

  it("counts a rejected request and storage that refuses the merge as failed syncs", async () => {
    const rejecting = setup(async () => {
      throw new Error("offline");
    });
    expect(await rejecting.backend.loadProgress()).toBeNull();
    expect(rejecting.backend.status()).toBe("pending");
    const full = createSyncedBackend({
      local: {
        ...createLocalBackend({
          gameId: "g",
          storage: { getItem: () => null, setItem: () => undefined },
        }),
        replace: () => {
          throw new Error("quota");
        },
      },
      remote: {
        sync: async () => ({
          kind: "synced",
          playerId: accountPlayer,
          state: remoteState,
        }),
      },
    });
    await full.loadProgress();
    expect(full.status()).toBe("pending");
  });

  it("never has two requests in flight, and ends with the latest state", async () => {
    const releases: (() => void)[] = [];
    let inFlight = 0;
    let peak = 0;
    const { backend, sync } = setup(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise<void>((release) => releases.push(release));
      inFlight -= 1;
      return { kind: "synced", playerId: accountPlayer, state: empty };
    });
    releases.shift()?.call(undefined);
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    releases.splice(0).forEach((release) => release());
    await backend.loadProgress();
    await backend.saveProgress({ taps: 1 }, at);
    await backend.saveProgress({ taps: 2 }, at);
    await backend.saveProgress({ taps: 3 }, at);
    await vi.waitFor(() => expect(releases.length).toBe(1));
    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(releases.length).toBe(1));
    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(3));
    expect(peak).toBe(1);
    expect(sync.mock.calls[2]?.[0].progress?.state).toEqual({ taps: 3 });
  });
});
