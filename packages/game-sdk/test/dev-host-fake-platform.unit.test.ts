import { describe, expect, it, vi } from "vitest";

import { createFakePlatform } from "../src/dev-host/fake-platform.ts";
import { walletInfoSchema } from "../src/protocol.ts";

function setup(earnedIds: readonly string[] = ["first-win"]) {
  const emitted: [string, unknown][] = [];
  const onChange = vi.fn();
  const platform = createFakePlatform({
    earned: async (id) => earnedIds.includes(id),
    emit: (name, data) => void emitted.push([name, data]),
    localId: async () => "local-id-0001",
    onChange,
  });
  return { emitted, onChange, platform };
}

describe("the fake wallet", () => {
  it("starts disconnected, and connecting tells the game with an address the protocol accepts", () => {
    const { emitted, platform } = setup();
    expect(platform.wallet()).toBeNull();
    platform.connect();
    expect(platform.isConnected()).toBe(true);
    expect(walletInfoSchema.safeParse(platform.wallet()).success).toBe(true);
    expect(emitted).toEqual([
      ["wallet.changed", { wallet: platform.wallet() }],
    ]);
  });

  it("does nothing, and tells no one, when asked to connect twice or to disconnect while disconnected", () => {
    const { emitted, platform } = setup();
    platform.disconnect();
    platform.connect();
    platform.connect();
    expect(emitted).toHaveLength(1);
  });

  it("tells the game when it leaves", () => {
    const { emitted, platform } = setup();
    platform.connect();
    platform.disconnect();
    expect(platform.wallet()).toBeNull();
    expect(emitted.at(-1)).toEqual(["wallet.changed", { wallet: null }]);
  });

  it("moves between networks with a different address on each, telling the game only while connected", () => {
    const { emitted, platform } = setup();
    platform.setNetwork("mainnet");
    expect(emitted).toEqual([]);
    platform.connect();
    const mainnet = platform.wallet();
    platform.setNetwork("signet");
    const signet = platform.wallet();
    expect(mainnet?.network).toBe("mainnet");
    expect(signet?.network).toBe("signet");
    expect(mainnet?.address).not.toBe(signet?.address);
    expect(emitted.at(-1)).toEqual(["wallet.changed", { wallet: signet }]);
    platform.setNetwork("signet");
    expect(emitted).toHaveLength(2);
  });

  it("says something changed whenever something did", () => {
    const { onChange, platform } = setup();
    platform.connect();
    platform.setNetwork("mainnet");
    platform.disconnect();
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});

describe("signing in", () => {
  it("gives the player this browser's id until they sign in, then the account's, and tells the game each time it changes", async () => {
    const { emitted, platform } = setup();
    expect(await platform.identity()).toEqual({
      id: "local-id-0001",
      kind: "local",
    });
    await platform.setSignedIn(true);
    expect(platform.isSignedIn()).toBe(true);
    expect(await platform.identity()).toEqual({
      id: "dev-account-0001",
      kind: "account",
    });
    await platform.setSignedIn(false);
    expect(emitted).toEqual([
      ["player.changed", { id: "dev-account-0001", kind: "account" }],
      ["player.changed", { id: "local-id-0001", kind: "local" }],
    ]);
  });

  it("does nothing when asked for the state it is already in", async () => {
    const { emitted, platform } = setup();
    await platform.setSignedIn(false);
    expect(emitted).toEqual([]);
  });
});

describe("a claim", () => {
  async function ready(earnedIds?: readonly string[]) {
    const s = setup(earnedIds);
    await s.platform.setSignedIn(true);
    s.platform.connect();
    s.emitted.length = 0;
    return s;
  }

  it.each([
    [
      "signed out",
      async (p: ReturnType<typeof setup>["platform"]) => {
        p.connect();
      },
      "signed-out",
    ],
    [
      "without a wallet",
      async (p: ReturnType<typeof setup>["platform"]) => {
        await p.setSignedIn(true);
      },
      "no-wallet",
    ],
  ] as const)("is refused %s", async (_name, prepare, reason) => {
    const { platform } = setup();
    await prepare(platform);
    expect(await platform.claim("first-win")).toEqual({
      reason,
      status: "unavailable",
    });
    expect(platform.claims()).toEqual([]);
  });

  it("is refused for a milestone the game has not earned", async () => {
    const { platform } = await ready([]);
    expect(await platform.claim("first-win")).toEqual({
      reason: "not-earned",
      status: "unavailable",
    });
  });

  it("is requested, and waits for the wallet, telling the game", async () => {
    const { emitted, platform } = await ready();
    expect(await platform.claim("first-win")).toEqual({ status: "requested" });
    expect(platform.claims()).toEqual([
      { milestoneId: "first-win", state: "awaiting-signature" },
    ]);
    expect(emitted).toEqual([
      ["claim.changed", { id: "first-win", state: "awaiting-signature" }],
    ]);
  });

  it("is the same claim when asked for again while it is under way", async () => {
    const { emitted, platform } = await ready();
    await platform.claim("first-win");
    await platform.claim("first-win");
    expect(platform.claims()).toHaveLength(1);
    expect(emitted).toHaveLength(1);
  });

  it("goes from waiting to sent to confirmed to complete, one press each, and stops there", async () => {
    const { emitted, platform } = await ready();
    await platform.claim("first-win");
    for (let press = 0; press < 5; press += 1) platform.press("first-win");
    expect(platform.claims()[0]?.state).toBe("complete");
    expect(
      emitted.map(([, data]) => (data as { state: string }).state),
    ).toEqual(["awaiting-signature", "pending", "claimed", "complete"]);
  });

  it("can be started again once it is complete, and pressing for a claim that does not exist does nothing", async () => {
    const { emitted, platform } = await ready();
    platform.press("nothing");
    await platform.claim("first-win");
    for (let press = 0; press < 3; press += 1) platform.press("first-win");
    await platform.claim("first-win");
    expect(platform.claims()).toEqual([
      { milestoneId: "first-win", state: "awaiting-signature" },
    ]);
    expect(emitted.at(-1)).toEqual([
      "claim.changed",
      { id: "first-win", state: "awaiting-signature" },
    ]);
  });
});
