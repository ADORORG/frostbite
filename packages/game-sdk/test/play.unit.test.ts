import { describe, expect, it, vi } from "vitest";

import { connectToPlatform } from "../src/play.ts";
import type { RunRecord } from "../src/run-record.ts";

const milestone = (id: string) => ({ id, status: "locked", title: id });
const record: RunRecord = {
  claims: ["a"],
  config: {},
  gameId: "g",
  inputs: [{ data: { tick: 3 }, type: "jump" }],
  schemaVersion: 1,
  seed: 5,
  verifier: "g",
  verifierVersion: 1,
};

function client(overrides: Record<string, unknown> = {}) {
  return {
    milestones: {
      list: vi.fn(async () => [milestone("a"), milestone("b")]),
      unlock: vi.fn(async () => ({ status: "unlocked" })),
    },
    run: {
      start: vi.fn(async () => ({ runId: "r", seed: 9, status: "started" })),
      submit: vi.fn(async () => ({ earned: [], status: "verified" })),
    },
    ...overrides,
  } as never;
}

describe("reporting milestones", () => {
  it("tells the platform of a declared milestone once, and never of one the manifest does not declare", async () => {
    const platform = client();
    const play = await connectToPlatform(platform);
    play.report("a");
    play.report("a");
    play.report("not-declared");
    const { unlock } = (
      platform as { milestones: { unlock: ReturnType<typeof vi.fn> } }
    ).milestones;
    expect(unlock.mock.calls).toEqual([["a"]]);
  });

  it("tries again when a report failed, so a milestone is not lost to one bad call", async () => {
    const unlock = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue({ status: "unlocked" });
    const play = await connectToPlatform(
      client({ milestones: { list: async () => [milestone("a")], unlock } }),
    );
    play.report("a");
    await Promise.resolve();
    await Promise.resolve();
    play.report("a");
    expect(unlock).toHaveBeenCalledTimes(2);
  });

  it("reports nothing when the platform cannot say what is declared", async () => {
    const unlock = vi.fn();
    const play = await connectToPlatform(
      client({
        milestones: {
          list: async () => {
            throw new Error("no host");
          },
          unlock,
        },
      }),
    );
    play.report("a");
    expect(unlock).not.toHaveBeenCalled();
  });
});

describe("runs", () => {
  it("starts one on the platform, and says so when it cannot", async () => {
    const play = await connectToPlatform(client());
    expect(await play.runs.start()).toEqual({
      runId: "r",
      seed: 9,
      status: "started",
    });
    const away = await connectToPlatform(
      client({
        run: {
          start: async () => {
            throw new Error("no host");
          },
          submit: vi.fn(),
        },
      }),
    );
    expect(await away.runs.start()).toEqual({
      reason: "not-supported",
      status: "unavailable",
    });
  });

  it("hands over a record as plain data, in its one canonical text", async () => {
    const submit = vi.fn(async () => ({ earned: [], status: "verified" }));
    const play = await connectToPlatform(
      client({ run: { start: vi.fn(), submit } }),
    );
    await play.runs.submit("r", record);
    expect(submit).toHaveBeenCalledWith(
      "r",
      JSON.parse(JSON.stringify(record)),
    );
  });
});
