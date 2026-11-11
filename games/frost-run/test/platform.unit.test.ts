// @vitest-environment jsdom
import { defaultSound } from "@frostbite/game-sdk/audio/settings";
import { GameHostError } from "@frostbite/game-sdk/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const host = vi.hoisted(() => ({
  list: vi.fn(),
  load: vi.fn(),
  ready: vi.fn(),
  save: vi.fn(),
  send: vi.fn(),
  start: vi.fn(),
}));
vi.mock("@frostbite/game-sdk/client", async (original) => ({
  ...(await original<typeof import("@frostbite/game-sdk/client")>()),
  createGameClient: () => ({
    milestones: { list: host.list },
    progress: { load: host.load, save: host.save },
    ready: host.ready,
  }),
}));
vi.mock("@frostbite/game-sdk/play", () => ({
  connectToPlatform: async () => ({
    report: vi.fn(),
    runs: { start: host.start },
  }),
  sendRun: host.send,
}));

const { createPlatform } = await import("../src/platform.ts");
const { words } = await import("../src/words.ts");

beforeEach(() => {
  vi.clearAllMocks();
  host.ready.mockResolvedValue(undefined);
  host.load.mockResolvedValue({ best: 12, sound: defaultSound });
  host.save.mockResolvedValue(undefined);
  host.list.mockResolvedValue([{ id: "first-crystal", title: "First light" }]);
  host.start.mockResolvedValue({ runId: "run-9", seed: 77, status: "started" });
});

describe("what the page asks of the platform", () => {
  it("connects, keeps the best and the sound, runs on the platform's seed and sends the run", async () => {
    const platform = createPlatform();
    const apply = vi.fn();
    expect(await platform.connect(apply)).toBe(words.connected);
    expect(apply).toHaveBeenCalledWith(defaultSound);
    expect(platform.best()).toBe(12);
    expect(platform.titleOf("first-crystal")).toBe("First light");
    expect(platform.titleOf("first-egg")).toBe("Egg in hand");
    expect(platform.titleOf("nothing")).toBe("nothing");
    expect(await platform.start()).toBe(77);
    expect(platform.settle(40)).toBe(true);
    expect(platform.settle(3)).toBe(false);
    expect(host.save).toHaveBeenLastCalledWith({
      best: 40,
      sound: defaultSound,
    });
    platform.keepSound({ ...defaultSound, music: false });
    expect(host.save).toHaveBeenLastCalledWith({
      best: 40,
      sound: { ...defaultSound, music: false },
    });
    platform.report("first-crystal");
    await platform.send({ claims: [] } as never);
    expect(host.send).toHaveBeenCalledWith(expect.anything(), "run-9", {
      claims: [],
    });
  });

  it("says what the platform said when it refuses, and plays on a seed of its own with no run to give", async () => {
    host.load.mockRejectedValue(new GameHostError("unavailable", "down"));
    host.start.mockResolvedValue({
      reason: "not-supported",
      status: "unavailable",
    });
    const platform = createPlatform();
    expect(await platform.connect(vi.fn())).toBe(
      "The platform said: unavailable",
    );
    const seed = await platform.start();
    expect(Number.isInteger(seed)).toBe(true);
    host.ready.mockRejectedValue(new Error("no frame"));
    host.save.mockRejectedValue(new Error("full"));
    const lonely = createPlatform();
    expect(await lonely.connect(vi.fn())).toBe(words.offline);
    expect(lonely.settle(1)).toBe(true);
  });
});
