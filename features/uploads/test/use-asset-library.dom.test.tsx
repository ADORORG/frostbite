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
    await act(async () => pending[1]?.({ assets: [], truncated: false }));
    await act(async () => {
      pending[0]?.({ assets: [stale], truncated: false });
    });
    expect(library().state).toEqual({
      library: { assets: [], truncated: false },
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
      pending[1]?.resolve({ assets: [], truncated: false }),
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
            truncated: false,
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
});
