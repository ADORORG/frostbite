import { describe, expect, it, vi } from "vitest";

import { sendRun, type PlatformPlay } from "../src/play.ts";
import type { RunRecord } from "../src/run-record.ts";

const record = { gameId: "g" } as unknown as RunRecord;
const playWith = (submit: PlatformPlay["runs"]["submit"]): PlatformPlay => ({
  report: () => undefined,
  runs: { start: vi.fn(), submit },
});

describe("sending a finished run to the platform", () => {
  it("hands the platform the record under the run it issued", async () => {
    const submit = vi.fn().mockResolvedValue({ status: "verified" });
    await sendRun(playWith(submit), "r1", record);
    expect(submit).toHaveBeenCalledExactlyOnceWith("r1", record);
  });

  it("sends nothing when there is no platform or the platform gave no run", async () => {
    const submit = vi.fn();
    await sendRun(null, "r1", record);
    await sendRun(playWith(submit), null, record);
    expect(submit).not.toHaveBeenCalled();
  });

  it("drops the run when the platform cannot be reached, and says nothing to the player", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(
      sendRun(playWith(submit), "r1", record),
    ).resolves.toBeUndefined();
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
