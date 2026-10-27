// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  flush,
  harness as h,
  mount,
  registerHarness,
  send,
} from "./support/player-harness.tsx";
import {
  claimAt,
  claimGame,
  earned,
  fakeApi,
  milestoneId,
  until,
  wallet,
} from "./support/claims-ui.tsx";

registerHarness();

const text = () => h.container.textContent;
const button = (name: string) =>
  [...h.container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.includes(name),
  );
const click = (name: string) =>
  act(async () => {
    button(name)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const review = () => h.container.querySelector('[data-testid="claim-review"]');
const changes = (reply: { mock: { calls: unknown[][] } }) =>
  reply.mock.calls
    .map(
      ([message]) => message as { data?: { state?: string }; event?: string },
    )
    .filter(({ event }) => event === "claim.changed")
    .map(({ data }) => data?.state);

describe("claiming from the milestone list", () => {
  it("offers Claim only for a milestone that is earned, and not on a game with no claims", async () => {
    const api = fakeApi();
    const { target } = await mount(undefined, {
      claims: { api, wallet },
      game: claimGame,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    expect(button("Claim ")).toBeUndefined();
    send(target, "milestones.unlock", { id: milestoneId }, "b");
    await flush();
    expect(button("Claim ")).toBeDefined();
  });

  it("starts the claim with the connected wallet's address and shows the review: what it does, the fee, and that the player pays it", async () => {
    const api = fakeApi();
    await earned({ api, wallet });
    await click("Claim ");
    await flush();
    expect(api.start).toHaveBeenCalledExactlyOnceWith({
      gameId: "embedded-game",
      milestoneId,
      wallet: wallet.address,
    });
    expect(review()?.getAttribute("data-state")).toBe("awaiting-signature");
    expect(text()).toContain("rewards-1");
    expect(text()).toContain("12 sim");
    expect(text()).toContain("You pay the network fee");
    expect(text()).toContain("Waiting for your wallet");
  });

  it("shows the cost clearly: the satoshis, the rate, the speed with its wait, and the size", async () => {
    const base = claimAt("awaiting-signature");
    const api = fakeApi({
      start: vi.fn(async () => ({
        claim: {
          ...base,
          summary: {
            ...base.summary,
            fee: { asset: "btc", baseUnits: "5050" },
            feeDetail: {
              approxMinutes: 250,
              satPerVb: 25.25,
              speed: "slow" as const,
            },
          },
        },
        resumed: false,
        status: "started" as const,
      })),
    });
    await earned({ api, wallet });
    await click("Claim ");
    await flush();
    expect(review()?.querySelector(".cost-overview__total")?.textContent).toBe(
      "5,050 sats",
    );
    expect(
      [...(review()?.querySelectorAll(".cost-overview li") ?? [])].map(
        (item) => item.textContent,
      ),
    ).toEqual(["Priced at 25 sat/vB", "Slow, about 4 h", "About 200 vB"]);
  });

  it("signs what was shown, sends it, and follows the claim to complete, saying confirmed is not complete and telling the game each step", async () => {
    const answers = [claimAt("claimed"), claimAt("complete")];
    let sent = false;
    const api = fakeApi({
      // Until the signed claim is sent, the platform still has it waiting for the wallet.
      refresh: vi.fn(async () => ({
        claim: sent
          ? (answers.shift() ?? claimAt("complete"))
          : claimAt("awaiting-signature"),
        status: "ok" as const,
      })),
      submit: vi.fn(async () => {
        sent = true;
        return { claim: claimAt("pending"), status: "submitted" as const };
      }),
    });
    const sign = vi.fn(
      async (
        t: Parameters<NonNullable<Parameters<typeof earned>[0]["sign"]>>[0],
      ) => ({
        ...t,
        payload: `${t.payload}.sig`,
      }),
    );
    const { reply } = await earned({ api, pollMs: 10, sign, wallet });
    await click("Claim ");
    await flush();
    await click("Sign with your wallet");
    expect(sign).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ payload: "{}" }),
    );
    expect(api.submit).toHaveBeenCalledWith({
      claimId: claimAt("pending").id,
      signed: expect.objectContaining({ payload: "{}.sig" }),
    });
    await until(() => text().includes("The network's records show it"));
    expect(text()).toContain("Claim: Claimed");
    expect(changes(reply)).toEqual([
      "awaiting-signature",
      "pending",
      "claimed",
      "complete",
    ]);
  });

  it("stops looking at a claim once it is over", async () => {
    const api = fakeApi({
      refresh: vi.fn(async () => ({
        claim: claimAt("failed", { failureReason: "reverted by the network" }),
        status: "ok" as const,
      })),
    });
    await earned({ api, pollMs: 10, sign: async (t) => t, wallet });
    await click("Claim ");
    await flush();
    await click("Sign with your wallet");
    await until(() => text().includes("Failed"));
    expect(text()).toContain("reverted by the network");
    const looks = vi.mocked(api.refresh).mock.calls.length;
    await flush();
    await flush();
    expect(vi.mocked(api.refresh).mock.calls.length).toBe(looks);
  });
});

describe("signing", () => {
  it("says the connected wallet cannot sign claims, and does not offer a signature that cannot be made", async () => {
    const api = fakeApi();
    await earned({ api, wallet });
    await click("Claim ");
    await flush();
    expect(text()).toContain("wallet you connected cannot sign claims");
    expect(button("Sign with your wallet")?.hasAttribute("disabled")).toBe(
      true,
    );
    expect(api.submit).not.toHaveBeenCalled();
  });

  it("sends nothing when the wallet signs nothing", async () => {
    const api = fakeApi();
    await earned({ api, sign: async () => null, wallet });
    await click("Claim ");
    await flush();
    await click("Sign with your wallet");
    expect(text()).toContain("Nothing was signed.");
    expect(api.submit).not.toHaveBeenCalled();
  });

  it.each([
    ["expired", "not signed in time"],
    ["invalid-signature", "not what was shown"],
    ["not-awaiting-signature", "can no longer be signed"],
    ["not-found", "could not be found"],
    ["chain-unavailable", "could not be reached"],
  ] as const)(
    "says what the platform refused a signature for: %s",
    async (reason, copy) => {
      const api = fakeApi({
        submit: vi.fn(async () => ({ reason, status: "refused" as const })),
      });
      await earned({ api, sign: async (t) => t, wallet });
      await click("Claim ");
      await flush();
      await click("Sign with your wallet");
      expect(text()).toContain(copy);
    },
  );

  it("says the platform could not be reached when sending fails, and lets the player try again", async () => {
    const api = fakeApi({
      submit: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    await earned({ api, sign: async (t) => t, wallet });
    await click("Claim ");
    await flush();
    await click("Sign with your wallet");
    expect(text()).toContain(
      "The platform could not be reached. Nothing was changed.",
    );
    expect(button("Sign with your wallet")?.hasAttribute("disabled")).toBe(
      false,
    );
  });
});
