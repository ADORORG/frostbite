// @vitest-environment jsdom

import type { RunsService } from "@frostbite/game-sdk/host";
import type { AccountPort } from "@frostbite/game-sdk/synced-backend";
import { describe, expect, it, vi } from "vitest";

import {
  flush,
  game,
  harness as h,
  mount,
  registerHarness,
  send,
} from "./support/player-harness.tsx";

registerHarness();

const runGame = { ...game, capabilities: ["run:submit"] };
const runId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const started = {
  expiresAt: "2026-10-16T12:00:00.000Z",
  runId,
  seed: 7,
  status: "started",
} as const;
const answer = (reply: { mock: { calls: unknown[][] } }, id: string) =>
  reply.mock.calls
    .map(([message]) => message)
    .find((message) => (message as { id?: string }).id === id);
const service = (overrides: Partial<RunsService> = {}) => {
  const runs: RunsService = {
    start: vi.fn(async () => started),
    submit: vi.fn(async () => ({ earned: [], status: "verified" as const })),
    ...overrides,
  };
  return { runs, runsFor: () => runs };
};

describe("runs on the game page", () => {
  it("gives a game that declared run:submit the platform's run, and sends its record to the platform", async () => {
    const { runs, runsFor } = service();
    const { reply, target } = await mount(undefined, {
      game: runGame,
      runsFor,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "run.start", {}, "b");
    send(target, "run.submit", { record: { seed: 7 }, runId }, "c");
    await flush();
    expect(answer(reply, "b")).toMatchObject({ ok: true, result: started });
    expect(answer(reply, "c")).toMatchObject({
      ok: true,
      result: { earned: [], status: "verified" },
    });
    expect(runs.submit).toHaveBeenCalledWith(runId, { seed: 7 });
  });

  it("refuses a game that did not declare run:submit, and never asks the platform", async () => {
    const { runs, runsFor } = service();
    const { reply, target } = await mount(undefined, { game, runsFor });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "run.start", {}, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({
      error: { code: "permission_denied" },
      ok: false,
    });
    expect(runs.start).not.toHaveBeenCalled();
  });

  it("tells the game when nobody is signed in, so it plays on self-reported", async () => {
    const { runsFor } = service({
      start: async () => ({ reason: "signed-out", status: "unavailable" }),
    });
    const { reply, target } = await mount(undefined, {
      game: runGame,
      runsFor,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "run.start", {}, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({
      result: { reason: "signed-out", status: "unavailable" },
    });
  });

  it("shows the milestone the platform verified, taken back from the account, without the game reporting it", async () => {
    const first = game.milestones[0]?.id ?? "";
    const empty = { counters: [], milestones: [], progress: null };
    let syncs = 0;
    const sync = vi.fn<AccountPort["sync"]>(async () => {
      syncs += 1;
      return {
        kind: "synced",
        playerId: runId,
        state:
          syncs === 1
            ? empty
            : {
                ...empty,
                milestones: [
                  {
                    count: 1,
                    id: first,
                    unlockedAt: "2026-10-05T00:00:00.000Z",
                    verification: "replay-verified",
                  },
                ],
              },
      };
    });
    const { runsFor } = service({
      submit: async () => ({ earned: [first], status: "verified" }),
    });
    const { target } = await mount(() => ({ sync }), {
      game: runGame,
      runsFor,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "run.submit", { record: {}, runId }, "b");
    await flush();
    expect(sync).toHaveBeenCalledTimes(2);
    expect(h.container.textContent).toContain("2026-10-05");
    expect(h.container.textContent).toContain("Replay-checked");
  });
});
