import { describe, expect, it, vi } from "vitest";

import {
  createGameHost,
  type HostEvent,
  type HostServices,
} from "../src/host.ts";
import type { RunsService } from "../src/host-types.ts";
import { resolveGameHostPolicy } from "../src/policy.ts";
import type { Response } from "../src/protocol.ts";
import { game, memoryBackend, request } from "./support.ts";

const runGame = { ...game, capabilities: ["run:submit"] };
const runId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const started = {
  expiresAt: "2026-10-16T12:00:00.000Z",
  runId,
  seed: 4_000_000_000,
  status: "started",
} as const;

function setup(
  options: {
    backend?: ReturnType<typeof memoryBackend>["backend"];
    game?: typeof game;
    policy?: Parameters<typeof resolveGameHostPolicy>[0];
    services?: HostServices;
  } = {},
) {
  const replies: Response[] = [];
  const events: HostEvent[] = [];
  const host = createGameHost({
    backend: options.backend ?? memoryBackend().backend,
    game: options.game ?? runGame,
    onEvent: (event) => events.push(event),
    policy: resolveGameHostPolicy(options.policy),
    push: () => undefined,
    reply: (response) => replies.push(response),
    services: options.services,
  });
  return {
    events,
    host,
    ask: async (method: string, params: unknown = {}, id = "c1") => {
      await host.handle(request(method, params, id));
      return replies.at(-1);
    },
    ready: () => host.handle(request("ready", { sdkVersion: 1 }, "r")),
  };
}
const submission = { record: { any: ["json"] }, runId };

describe("starting a run", () => {
  it("gives the game the platform's run: its id, seed and expiry", async () => {
    const start = vi.fn(async () => started);
    const s = setup({ services: { runs: { start, submit: vi.fn() } } });
    await s.ready();
    expect(await s.ask("run.start")).toMatchObject({
      ok: true,
      result: started,
    });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("tells a game that the platform cannot give a run when the page offers none, or says why", async () => {
    const none = setup();
    await none.ready();
    expect(await none.ask("run.start")).toMatchObject({
      ok: true,
      result: { reason: "not-supported", status: "unavailable" },
    });
    const signedOut = setup({
      services: {
        runs: {
          start: async () => ({ reason: "signed-out", status: "unavailable" }),
          submit: vi.fn(),
        },
      },
    });
    await signedOut.ready();
    expect(await signedOut.ask("run.start")).toMatchObject({
      result: { reason: "signed-out", status: "unavailable" },
    });
  });

  it("is refused without the run:submit capability, and before ready, and never reaches the page", async () => {
    const start = vi.fn(async () => started);
    const services = { runs: { start, submit: vi.fn() } };
    const before = setup({ services });
    expect(await before.ask("run.start")).toMatchObject({
      error: { code: "not_ready" },
      ok: false,
    });
    const undeclared = setup({ game, services });
    await undeclared.ready();
    expect(await undeclared.ask("run.start")).toMatchObject({
      error: { code: "permission_denied" },
      ok: false,
    });
    expect(start).not.toHaveBeenCalled();
  });

  it("answers a page that fails as unavailable, without its reason", async () => {
    const s = setup({
      services: {
        runs: {
          start: async () => {
            throw new Error("database password is hunter2");
          },
          submit: vi.fn(),
        },
      },
    });
    await s.ready();
    const answer = await s.ask("run.start");
    expect(answer).toMatchObject({ error: { code: "unavailable" }, ok: false });
    expect(JSON.stringify(answer)).not.toContain("hunter2");
  });
});

describe("submitting a run", () => {
  it("hands the record to the page as sent and gives the game the verdict", async () => {
    const submit = vi.fn(async () => ({
      earned: ["first-five"],
      status: "verified" as const,
    }));
    const s = setup({ services: { runs: { start: vi.fn(), submit } } });
    await s.ready();
    expect(await s.ask("run.submit", submission)).toMatchObject({
      ok: true,
      result: { earned: ["first-five"], status: "verified" },
    });
    expect(submit).toHaveBeenCalledWith(runId, submission.record);
  });

  it("brings the account's verified milestones back before answering, and tells the player", async () => {
    const order: string[] = [];
    const base = memoryBackend().backend;
    const backend = {
      ...base,
      refreshVerified: async () => void order.push("refreshed"),
    };
    const s = setup({
      backend,
      services: {
        runs: {
          start: vi.fn(),
          submit: async () => {
            order.push("submitted");
            return { earned: ["first-five"], status: "verified" as const };
          },
        },
      },
    });
    await s.ready();
    await s.ask("run.submit", submission);
    expect(order).toEqual(["submitted", "refreshed"]);
    expect(s.events).toContainEqual({
      earned: ["first-five"],
      type: "run-verified",
    });
  });

  it("does not refresh or announce a rejected record, a refusal, or a verdict that earned nothing", async () => {
    const refreshVerified = vi.fn(async () => undefined);
    const backend = { ...memoryBackend().backend, refreshVerified };
    const outcomes: Awaited<ReturnType<RunsService["submit"]>>[] = [
      { reason: "illegal-input", status: "rejected" },
      { reason: "expired", status: "refused" },
      { earned: [], status: "verified" },
    ];
    for (const outcome of outcomes) {
      const s = setup({
        backend,
        services: { runs: { start: vi.fn(), submit: async () => outcome } },
      });
      await s.ready();
      expect(await s.ask("run.submit", submission)).toMatchObject({
        ok: true,
        result: outcome,
      });
      expect(s.events.some(({ type }) => type === "run-verified")).toBe(false);
    }
    expect(refreshVerified).not.toHaveBeenCalled();
  });

  it("refuses a record over the policy's size before the page sees it, and one that is not JSON", async () => {
    const submit = vi.fn();
    const s = setup({
      policy: { runRecordMaxBytes: 1_024 },
      services: { runs: { start: vi.fn(), submit } },
    });
    await s.ready();
    expect(
      await s.ask("run.submit", { record: { pad: "x".repeat(1_100) }, runId }),
    ).toMatchObject({ error: { code: "too_large" }, ok: false });
    expect(
      await s.ask("run.submit", { record: undefined, runId }, "c2"),
    ).toMatchObject({ error: { code: "invalid_request" }, ok: false });
    expect(submit).not.toHaveBeenCalled();
  });

  it("says there is no such run when the page offers no runs, and needs the capability", async () => {
    const none = setup();
    await none.ready();
    expect(await none.ask("run.submit", submission)).toMatchObject({
      result: { reason: "unknown-run", status: "refused" },
    });
    const undeclared = setup({ game });
    await undeclared.ready();
    expect(await undeclared.ask("run.submit", submission)).toMatchObject({
      error: { code: "permission_denied" },
    });
  });
});

describe("how often a game may start and submit runs", () => {
  it("shares one allowance between the two, refusing past it with rate_limited and not calling the page", async () => {
    const start = vi.fn(async () => started);
    const submit = vi.fn(async () => ({
      reason: "expired" as const,
      status: "refused" as const,
    }));
    const s = setup({
      policy: { runCallsPerMinute: 2 },
      services: { runs: { start, submit } },
    });
    await s.ready();
    expect(await s.ask("run.start", {}, "a")).toMatchObject({ ok: true });
    expect(await s.ask("run.submit", submission, "b")).toMatchObject({
      ok: true,
    });
    expect(await s.ask("run.start", {}, "c")).toMatchObject({
      error: { code: "rate_limited" },
    });
    expect(await s.ask("run.submit", submission, "d")).toMatchObject({
      error: { code: "rate_limited" },
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
