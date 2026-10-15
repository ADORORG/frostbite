import { act } from "react";
import type { LibraryResponse } from "@ador/shared/uploads";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveUploadClientPolicy } from "../src/client/client-policy.ts";
import {
  useAssetLibrary,
  type AssetLibrary,
} from "../src/ui/hooks/use-asset-library.ts";
import { fakeServices, mount, unmountAll } from "./support/dom.tsx";
import { libraryAsset, processedAsset } from "./support/library-fixtures.ts";

afterEach(() => vi.useRealTimers());

function probe(services: ReturnType<typeof fakeServices>) {
  const holder: { current: AssetLibrary | null } = { current: null };
  function Probe() {
    holder.current = useAssetLibrary(services);
    return null;
  }
  const library = () => {
    if (holder.current === null) throw new Error("hook not mounted");
    return holder.current;
  };
  return { Probe, library };
}

const slowPolicy = resolveUploadClientPolicy({
  minimumRefreshDelayMs: 10_000,
  pollIntervalMs: 10_000,
  pollMaxAttempts: 3,
  signedUrlRefreshMarginMs: 1,
});

describe("asset library hook", () => {
  it("ignores a response that arrives after a newer request has been made", async () => {
    const pending: ((value: LibraryResponse) => void)[] = [];
    const stale = processedAsset({
      id: "018f22f2-9c1a-7b21-8c45-0000000000aa",
    });
    const services = fakeServices({
      api: {
        listAssets: () =>
          new Promise((resolve) => {
            pending.push(resolve);
          }),
      },
    });
    const { Probe, library } = probe(services);
    await mount(<Probe />);
    await act(async () => library().refresh());
    expect(pending).toHaveLength(2);
    // The newer request answers first, then the superseded one answers late with different data.
    await act(async () => pending[1]?.({ assets: [], nextCursor: null }));
    await act(async () => {
      pending[0]?.({ assets: [stale], nextCursor: null });
    });
    expect(library().state).toEqual({
      library: { assets: [], nextCursor: null },
      status: "ready",
    });
  });

  it("ignores a failure that arrives after a newer request succeeded", async () => {
    const pending: {
      reject: (error: Error) => void;
      resolve: (value: LibraryResponse) => void;
    }[] = [];
    const services = fakeServices({
      api: {
        listAssets: () =>
          new Promise((resolve, reject) => {
            pending.push({ reject, resolve });
          }),
      },
    });
    const { Probe, library } = probe(services);
    await mount(<Probe />);
    await act(async () => library().refresh());
    await act(async () =>
      pending[1]?.resolve({ assets: [], nextCursor: null }),
    );
    await act(async () => pending[0]?.reject(new Error("late failure")));
    expect(library().state.status).toBe("ready");
  });

  it("keeps exactly one refresh timer after a manual refresh, and none after unmount", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const services = {
      ...fakeServices({
        api: {
          listAssets: async () => ({
            assets: [libraryAsset()],
            nextCursor: null,
          }),
        },
      }),
      policy: slowPolicy,
    };
    const { Probe, library } = probe(services);
    await mount(<Probe />);
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => library().refresh());
    expect(vi.getTimerCount()).toBe(1);
    await unmountAll();
    expect(vi.getTimerCount()).toBe(0);
  });

  describe("older pages", () => {
    const cursorOf = (n: number) =>
      `${String(1_760_000_000_000 + n)}.0198a000-0000-7000-8000-00000000000${String(n)}`;
    const asset = (n: number) =>
      processedAsset({ id: `018f22f2-9c1a-7b21-8c45-00000000000${String(n)}` });

    it("adds the next page to what is shown, and offers no more once the list ends", async () => {
      const services = fakeServices({
        api: {
          listAssets: async () => ({
            assets: [asset(1)],
            nextCursor: cursorOf(1),
          }),
          listOlderAssets: async (before) =>
            before === cursorOf(1)
              ? { assets: [asset(2)], nextCursor: cursorOf(2) }
              : { assets: [asset(3)], nextCursor: null },
        },
      });
      const { Probe, library } = probe(services);
      await mount(<Probe />);
      await act(async () => library().loadMore());
      await act(async () => library().loadMore());
      const state = library().state;
      expect(
        state.status === "ready" && state.library.assets.map(({ id }) => id),
      ).toEqual([1, 2, 3].map((n) => asset(n).id));
      expect(state.status === "ready" && state.library.nextCursor).toBeNull();
      services.api.listOlderAssets.mockClear();
      await act(async () => library().loadMore());
      expect(services.api.listOlderAssets).not.toHaveBeenCalled();
    });

    it("does not fetch a second page while one is on its way", async () => {
      let release: (value: LibraryResponse) => void = () => undefined;
      const services = fakeServices({
        api: {
          listAssets: async () => ({
            assets: [asset(1)],
            nextCursor: cursorOf(1),
          }),
          listOlderAssets: () => new Promise((resolve) => (release = resolve)),
        },
      });
      const { Probe, library } = probe(services);
      await mount(<Probe />);
      await act(async () => library().loadMore());
      expect(library().loadingMore).toBe(true);
      await act(async () => library().loadMore());
      expect(services.api.listOlderAssets).toHaveBeenCalledTimes(1);
      await act(async () => release({ assets: [asset(2)], nextCursor: null }));
      expect(library().loadingMore).toBe(false);
    });

    it("reloads as many pages as are shown, so older images' signed links are renewed too", async () => {
      const services = fakeServices({
        api: {
          listAssets: async () => ({
            assets: [asset(1)],
            nextCursor: cursorOf(1),
          }),
          listOlderAssets: async () => ({
            assets: [asset(2)],
            nextCursor: null,
          }),
        },
      });
      const { Probe, library } = probe(services);
      await mount(<Probe />);
      await act(async () => library().loadMore());
      services.api.listAssets.mockClear();
      services.api.listOlderAssets.mockClear();
      await act(async () => library().refresh());
      expect(services.api.listAssets).toHaveBeenCalledTimes(1);
      expect(services.api.listOlderAssets).toHaveBeenCalledTimes(1);
      const state = library().state;
      expect(state.status === "ready" && state.library.assets).toHaveLength(2);
    });

    it("drops an older page that arrives after a reload replaced the list it continued", async () => {
      let first = true;
      let release: (value: LibraryResponse) => void = () => undefined;
      const services = fakeServices({
        api: {
          listAssets: async () => {
            const cursor = first ? cursorOf(1) : cursorOf(5);
            first = false;
            return { assets: [asset(1)], nextCursor: cursor };
          },
          listOlderAssets: () => new Promise((resolve) => (release = resolve)),
        },
      });
      const { Probe, library } = probe(services);
      await mount(<Probe />);
      await act(async () => library().loadMore());
      await act(async () => library().refresh());
      await act(async () => release({ assets: [asset(2)], nextCursor: null }));
      const state = library().state;
      expect(state.status === "ready" && state.library.assets).toHaveLength(1);
      expect(state.status === "ready" && state.library.nextCursor).toBe(
        cursorOf(5),
      );
    });

    it("keeps what is shown and says so when an older page cannot be fetched", async () => {
      const services = fakeServices({
        api: {
          listAssets: async () => ({
            assets: [asset(1)],
            nextCursor: cursorOf(1),
          }),
          listOlderAssets: async () => {
            throw new Error("offline");
          },
        },
      });
      const { Probe, library } = probe(services);
      await mount(<Probe />);
      await act(async () => library().loadMore());
      const state = library().state;
      expect(state.status).toBe("error");
      expect(state.status === "error" && state.library?.assets).toHaveLength(1);
      expect(library().loadingMore).toBe(false);
    });
  });
});
