import { ApiError } from "@frostbite/client-http";
import type { ChainIndexing } from "@frostbite/shared/chain";
import { mount, settle, textOf } from "@frostbite/test-kit/dom";
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

// The moment the pages are drawn at: the answers are read at `observedAt`, and the clock moves from there.
const clock = { at: Date.parse("2026-10-17T12:00:00.000Z") };
const now = () => clock.at;
const hidden = (value: boolean) =>
  Object.defineProperty(document, "hidden", { configurable: true, value });
afterEach(() => {
  hidden(false);
  clock.at = Date.parse("2026-10-17T12:00:00.000Z");
});

const apiOf = (indexing: ChainStatusApi["indexing"]): ChainStatusApi => ({
  fees: async () => ({ state: "none" as const }),
  indexing,
});

// What the pill says about the chain is its button's name (the words are in the panel it opens).
const named = (container: HTMLElement) =>
  container.querySelector("button")?.getAttribute("aria-label") ?? "";

describe("the header badge", () => {
  it("draws nothing until the platform has answered, then shows the answer", async () => {
    let answer: (value: ChainIndexing) => void = () => undefined;
    const api = apiOf(() => new Promise((resolve) => (answer = resolve)));
    const container = await mount(
      <IndexingBadge
        api={api}
        now={now}
        polling={{ forgetAfterMs: 600_000, refreshMs: 60_000 }}
        syncWindowBlocks={100}
      />,
    );
    expect(textOf(container)).toBe("");
    answer(ok("delayed", 7));
    await settle(() =>
      expect(named(container)).toContain("Delayed, 7 blocks behind"),
    );
  });

  it("asks again every interval and follows the indexer as it catches up", async () => {
    const indexing = vi
      .fn<ChainStatusApi["indexing"]>()
      .mockResolvedValueOnce(ok("delayed", 5))
      .mockResolvedValue(ok("current", 0));
    const container = await mount(
      <IndexingBadge
        api={apiOf(indexing)}
        now={now}
        syncWindowBlocks={100}
        polling={{ forgetAfterMs: 400, refreshMs: 20 }}
      />,
    );
    await settle(() => expect(named(container)).toContain("Chain in sync"));
    expect(indexing.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not ask while the tab is hidden, and asks again once it is shown", async () => {
    hidden(true);
    const indexing = vi.fn<ChainStatusApi["indexing"]>(async () =>
      ok("current", 0),
    );
    await mount(
      <IndexingBadge
        api={apiOf(indexing)}
        now={now}
        syncWindowBlocks={100}
        polling={{ forgetAfterMs: 600_000, refreshMs: 10 }}
      />,
    );
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
        now={now}
        syncWindowBlocks={100}
        polling={{ forgetAfterMs: 600_000, refreshMs: 60_000 }}
      />,
    );
    await settle(() =>
      expect(named(container)).toContain("Chain status unknown"),
    );
  });

  it("draws nothing at all where the platform follows no chain", async () => {
    const indexing = vi.fn<ChainStatusApi["indexing"]>(async () => ({
      state: "none",
    }));
    const container = await mount(
      <IndexingBadge
        api={apiOf(indexing)}
        now={now}
        syncWindowBlocks={100}
        polling={{ forgetAfterMs: 600_000, refreshMs: 60_000 }}
      />,
    );
    await settle(() => expect(indexing).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("keeps showing the last good answer, marked as not renewed, when a later ask fails, and says it does not know once that is too old", async () => {
    const indexing = vi
      .fn<ChainStatusApi["indexing"]>()
      .mockResolvedValueOnce(ok("current", 0))
      .mockRejectedValue(new ApiError("network", null, "unreachable"));
    const container = await mount(
      <IndexingBadge
        api={apiOf(indexing)}
        now={now}
        polling={{ forgetAfterMs: 400, refreshMs: 20 }}
        syncWindowBlocks={100}
      />,
    );
    await settle(() => expect(named(container)).toContain("Chain in sync"));
    await settle(() => expect(indexing.mock.calls.length).toBeGreaterThan(1));
    // Asks have failed, but the answer is young: it stays, and says nothing yet of being old.
    expect(named(container)).toContain("Chain in sync");
    expect(textOf(container)).not.toContain("could not renew");
    // Two refreshes on it is shown, as the last one read; twenty on it is not shown at all.
    clock.at += 40;
    await settle(() => {
      container.querySelector("button")?.click();
      expect(textOf(container)).toContain(
        "Last read 12:00:00 UTC; the platform could not renew it just now.",
      );
    });
    expect(named(container)).toContain("Chain in sync");
    clock.at += 400;
    await settle(() =>
      expect(named(container)).toContain("Chain status unknown"),
    );
  });
});
