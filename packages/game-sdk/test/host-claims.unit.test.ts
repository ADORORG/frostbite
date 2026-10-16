import { describe, expect, it, vi } from "vitest";

import {
  createGameHost,
  type ClaimsService,
  type HostServices,
} from "../src/host.ts";
import { defaultGameHostPolicy, resolveGameHostPolicy } from "../src/policy.ts";
import {
  claimStates,
  claimUnavailableReasons,
  events,
  methods,
  type EventMessage,
  type Response,
} from "../src/protocol.ts";
import { game as baseGame, memoryBackend, request } from "./support.ts";

function setup(options: {
  game: typeof baseGame;
  policy?: Parameters<typeof resolveGameHostPolicy>[0];
  services?: HostServices;
}) {
  const replies: Response[] = [];
  const pushed: EventMessage[] = [];
  const host = createGameHost({
    backend: memoryBackend().backend,
    game: options.game,
    policy: resolveGameHostPolicy(options.policy),
    push: (message) => pushed.push(message),
    reply: (response) => replies.push(response),
    services: options.services,
  });
  return {
    host,
    pushed,
    ready: () => host.handle(request("ready", { sdkVersion: 1 }, "r")),
    send: async (method: string, params: unknown = {}) => {
      await host.handle(request(method, params, "c1"));
      return replies.at(-1);
    },
  };
}
const ready = (s: { ready: () => Promise<void> }) => s.ready();

const game: typeof baseGame = {
  capabilities: ["milestone:claim"],
  id: "arcade",
  milestones: [
    {
      claimPolicy: "once" as const,
      criteria: "Win.",
      description: "You won.",
      id: "first-win",
      title: "First win",
    },
  ],
};
const requested = { status: "requested" } as const;

describe("the milestones.claim method", () => {
  it("asks the page to start a claim of a declared milestone, and passes on what the page says", async () => {
    const claim = vi.fn<ClaimsService["claim"]>(async () => requested);
    const s = setup({ game, services: { claims: { claim } } });
    await ready(s);
    expect(await s.send("milestones.claim", { id: "first-win" })).toMatchObject(
      {
        ok: true,
        result: { status: "requested" },
      },
    );
    expect(claim).toHaveBeenCalledExactlyOnceWith("first-win");
  });

  it.each(claimUnavailableReasons)(
    "passes on a page's refusal for %s",
    async (reason) => {
      const s = setup({
        game,
        services: {
          claims: { claim: async () => ({ reason, status: "unavailable" }) },
        },
      });
      await ready(s);
      expect(
        await s.send("milestones.claim", { id: "first-win" }),
      ).toMatchObject({
        ok: true,
        result: { reason, status: "unavailable" },
      });
    },
  );

  it("says claims are not supported when the page offers none", async () => {
    const s = setup({ game });
    await ready(s);
    expect(await s.send("milestones.claim", { id: "first-win" })).toMatchObject(
      {
        ok: true,
        result: { reason: "not-supported", status: "unavailable" },
      },
    );
  });

  it("refuses a milestone the game did not declare, and never asks the page", async () => {
    const claim = vi.fn<ClaimsService["claim"]>(async () => requested);
    const s = setup({ game, services: { claims: { claim } } });
    await ready(s);
    expect(await s.send("milestones.claim", { id: "made-up" })).toMatchObject({
      error: { code: "unknown_milestone" },
      ok: false,
    });
    expect(claim).not.toHaveBeenCalled();
  });

  it("refuses a game that did not declare the milestone:claim capability", async () => {
    const claim = vi.fn<ClaimsService["claim"]>(async () => requested);
    const s = setup({
      game: { ...game, capabilities: [] },
      services: { claims: { claim } },
    });
    await ready(s);
    expect(await s.send("milestones.claim", { id: "first-win" })).toMatchObject(
      {
        error: { code: "permission_denied" },
        ok: false,
      },
    );
    expect(claim).not.toHaveBeenCalled();
  });

  it("refuses parameters that are not an id, and extra ones", async () => {
    const s = setup({
      game,
      services: { claims: { claim: async () => requested } },
    });
    await ready(s);
    for (const params of [
      {},
      { id: "" },
      { id: 3 },
      { id: "x".repeat(65) },
      { id: "first-win", extra: 1 },
    ])
      expect(await s.send("milestones.claim", params)).toMatchObject({
        error: { code: "invalid_request" },
        ok: false,
      });
  });

  it("limits how often a game may ask, and counts only the asks that reach the page", async () => {
    const claim = vi.fn<ClaimsService["claim"]>(async () => requested);
    const s = setup({
      game,
      policy: resolveGameHostPolicy({ claimCallsPerMinute: 2 }),
      services: { claims: { claim } },
    });
    await ready(s);
    for (let ask = 0; ask < 2; ask += 1)
      expect(
        await s.send("milestones.claim", { id: "first-win" }),
      ).toMatchObject({ ok: true });
    expect(await s.send("milestones.claim", { id: "first-win" })).toMatchObject(
      {
        error: { code: "rate_limited" },
        ok: false,
      },
    );
    expect(claim).toHaveBeenCalledTimes(2);
  });

  it("reports a page that fails as unavailable without saying why", async () => {
    const s = setup({
      game,
      services: {
        claims: {
          claim: async () => {
            throw new Error("the database password is hunter2");
          },
        },
      },
    });
    await ready(s);
    const answer = await s.send("milestones.claim", { id: "first-win" });
    expect(answer).toMatchObject({ error: { code: "unavailable" }, ok: false });
    expect(JSON.stringify(answer)).not.toContain("hunter2");
  });
});

describe("the claim.changed event", () => {
  it("carries a milestone id and one of the six states, and nothing else", () => {
    for (const state of claimStates)
      expect(
        events["claim.changed"].safeParse({ id: "first-win", state }).success,
      ).toBe(true);
    expect(
      events["claim.changed"].safeParse({ id: "first-win", state: "minted" })
        .success,
    ).toBe(false);
    expect(
      events["claim.changed"].safeParse({ state: "complete" }).success,
    ).toBe(false);
    expect(
      events["claim.changed"].safeParse({ id: "x", state: "complete", tx: "t" })
        .success,
    ).toBe(false);
  });

  it("is sent only to a game that declared the capability", async () => {
    const granted = setup({ game });
    await ready(granted);
    granted.host.emit("claim.changed", { id: "first-win", state: "pending" });
    expect(granted.pushed).toHaveLength(1);
    const refused = setup({ game: { ...game, capabilities: [] } });
    await ready(refused);
    refused.host.emit("claim.changed", { id: "first-win", state: "pending" });
    expect(refused.pushed).toHaveLength(0);
  });

  it("keeps the states the protocol names equal to the ones the method and event share", () => {
    expect(
      methods["milestones.claim"].params.safeParse({ id: "a" }).success,
    ).toBe(true);
    expect([...claimStates]).toEqual([
      "awaiting-signature",
      "pending",
      "claimed",
      "complete",
      "failed",
      "expired",
    ]);
  });
});

describe("the policy", () => {
  it("limits claims to a few a minute by default and refuses a limit outside what is sensible", () => {
    expect(defaultGameHostPolicy.claimCallsPerMinute).toBe(6);
    expect(() => resolveGameHostPolicy({ claimCallsPerMinute: 0 })).toThrow();
    expect(() => resolveGameHostPolicy({ claimCallsPerMinute: 61 })).toThrow();
  });
});
