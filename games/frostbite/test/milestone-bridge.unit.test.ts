import { describe, expect, it, vi } from "vitest";

import {
  createMilestoneBridge,
  milestoneIdOf,
} from "../src/platform/milestone-bridge.ts";

const declared = (...ids: string[]) =>
  ids.map((id) => ({
    claimPolicy: "once" as const,
    criteria: id,
    description: id,
    id,
    status: "locked" as const,
    title: id,
    unlockedAt: null,
    verification: null,
  }));

function client(
  ids: string[],
  unlock = vi.fn(async () => ({
    status: "unlocked" as const,
    unlockedAt: "x",
  })),
) {
  return {
    milestones: {
      list: vi.fn(async () => declared(...ids)),
      unlock,
    },
  };
}

describe("a game mark as a platform milestone id", () => {
  it("turns the game's camelCase marks into slugs", () => {
    expect(milestoneIdOf("firstWin")).toBe("first-win");
    expect(milestoneIdOf("firstCashout")).toBe("first-cashout");
    expect(milestoneIdOf("first")).toBe("first");
  });
});

describe("reporting the game's marks to the platform", () => {
  it("reports a mark the manifest declares, once, however often the game makes it", async () => {
    const stub = client(["first-win"]);
    const bridge = await createMilestoneBridge(stub);
    bridge.report("firstWin");
    bridge.report("firstWin");
    expect(stub.milestones.unlock).toHaveBeenCalledTimes(1);
    expect(stub.milestones.unlock).toHaveBeenCalledWith("first-win");
  });

  it("does not report a mark the manifest does not declare: which marks count is the manifest's decision", async () => {
    const stub = client(["first-win"]);
    const bridge = await createMilestoneBridge(stub);
    bridge.report("firstBust");
    expect(stub.milestones.unlock).not.toHaveBeenCalled();
  });

  it("reports nothing when the platform cannot say what is declared", async () => {
    const stub = {
      milestones: {
        list: async () => {
          throw new Error("no host");
        },
        unlock: vi.fn(),
      },
    };
    const bridge = await createMilestoneBridge(stub);
    bridge.report("firstWin");
    expect(stub.milestones.unlock).not.toHaveBeenCalled();
  });

  it("tries a refused unlock again the next time the game makes the mark", async () => {
    let refuse = true;
    const unlock = vi.fn(async () => {
      if (refuse) throw new Error("down");
      return { status: "unlocked" as const, unlockedAt: "x" };
    });
    const bridge = await createMilestoneBridge(client(["first-win"], unlock));
    bridge.report("firstWin");
    await Promise.resolve();
    await Promise.resolve();
    refuse = false;
    bridge.report("firstWin");
    expect(unlock).toHaveBeenCalledTimes(2);
  });
});
