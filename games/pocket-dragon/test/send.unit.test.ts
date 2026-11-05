import type { PlatformPlay } from "@ador/game-sdk/play";
import { describe, expect, it, vi } from "vitest";

import { sendRun } from "../src/page/send.ts";
import { sampleRun } from "../src/sample-run.ts";

// Handing a finished run to the platform: once, under the platform's run, and never a reason for the page to stop.
const platform = (submit: PlatformPlay["runs"]["submit"]): PlatformPlay => ({
  report: vi.fn(),
  runs: { start: vi.fn(), submit },
});

describe("sending a finished run", () => {
  it("sends the record once, under the id the platform gave the run", async () => {
    const submit = vi.fn(async () => ({
      earned: [],
      status: "verified" as const,
    }));
    await sendRun(platform(submit), "run-7", sampleRun());
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith("run-7", sampleRun());
  });

  it("sends nothing without a platform or a run it gave", async () => {
    const submit = vi.fn();
    await sendRun(null, "run-7", sampleRun());
    await sendRun(platform(submit), null, sampleRun());
    expect(submit).not.toHaveBeenCalled();
  });

  it("drops a failure quietly", async () => {
    const submit = vi.fn(() => Promise.reject(new Error("unreachable")));
    await expect(
      sendRun(platform(submit), "run-7", sampleRun()),
    ).resolves.toBeUndefined();
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
