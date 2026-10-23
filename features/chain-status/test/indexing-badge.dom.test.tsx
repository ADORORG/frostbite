import { ApiError } from "@ador/client-http";
import type { ChainIndexing } from "@ador/shared/chain";
import { mount, settle, textOf } from "@ador/test-kit/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChainStatusApi } from "../src/client/api.ts";
import { IndexingBadge } from "../src/ui/indexing-badge.tsx";

const ok = (health: "current" | "delayed", lag: number): ChainIndexing => ({
  chain: "Bitcoin signet",
  health,
  indexedHeight: 100,
  lag,
  observedAt: "2026-10-17T12:00:00.000Z",
  state: "ok",
  tipHeight: 100 + lag,
});

const hidden = (value: boolean) =>
  Object.defineProperty(document, "hidden", { configurable: true, value });
afterEach(() => hidden(false));

const apiOf = (indexing: ChainStatusApi["indexing"]): ChainStatusApi => ({
  fees: () => Promise.reject(new Error("not used")),
  indexing,
});

describe("the header badge", () => {
  it("draws nothing until the platform has answered, then shows the answer", async () => {
    let answer: (value: ChainIndexing) => void = () => undefined;
    const api = apiOf(() => new Promise((resolve) => (answer = resolve)));
    const container = await mount(
      <IndexingBadge api={api} refreshMs={60_000} />,
    );
    expect(textOf(container)).toBe("");
    answer(ok("delayed", 7));
    await settle(() =>
      expect(textOf(container)).toContain("Delayed, 7 blocks behind"),
    );
  });

  it("asks again every interval and follows the indexer as it catches up", async () => {
    const indexing = vi
      .fn<ChainStatusApi["indexing"]>()
      .mockResolvedValueOnce(ok("delayed", 5))
      .mockResolvedValue(ok("current", 0));
    const container = await mount(
      <IndexingBadge api={apiOf(indexing)} refreshMs={20} />,
    );
    await settle(() => expect(textOf(container)).toContain("Chain in sync"));
    expect(indexing.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not ask while the tab is hidden, and asks again once it is shown", async () => {
    hidden(true);
    const indexing = vi.fn<ChainStatusApi["indexing"]>(async () =>
      ok("current", 0),
    );
    await mount(<IndexingBadge api={apiOf(indexing)} refreshMs={10} />);
    await settle(() => expect(indexing).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(indexing).toHaveBeenCalledTimes(1);
    hidden(false);
    await settle(() => expect(indexing.mock.calls.length).toBeGreaterThan(1));
  });

  it("says the status is unknown, rather than keeping a green lamp, when the platform cannot be reached", async () => {
    const container = await mount(
      <IndexingBadge
        api={apiOf(async () => {
          throw new ApiError("network", null, "unreachable");
        })}
        refreshMs={60_000}
      />,
    );
    await settle(() =>
      expect(textOf(container)).toContain("Chain status unknown"),
    );
  });

  it("draws nothing at all where the platform follows no chain", async () => {
    const indexing = vi.fn<ChainStatusApi["indexing"]>(async () => ({
      state: "none",
    }));
    const container = await mount(
      <IndexingBadge api={apiOf(indexing)} refreshMs={60_000} />,
    );
    await settle(() => expect(indexing).toHaveBeenCalled());
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
