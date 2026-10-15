import { describe, expect, it } from "vitest";

import { createGameClient } from "../src/client.ts";

type Listener = (event: { data: unknown; source: unknown }) => void;

function pair() {
  const listeners = new Set<Listener>();
  const sent: { id: string; method: string; params: unknown }[] = [];
  const host = {
    postMessage: (message: unknown) =>
      void sent.push(message as (typeof sent)[number]),
  };
  const client = createGameClient({
    host,
    listenOn: {
      addEventListener: (_t: "message", l: Listener) => listeners.add(l),
      removeEventListener: (_t: "message", l: Listener) => listeners.delete(l),
    },
    timeoutMs: 500,
  });
  const reply = (result: unknown) =>
    listeners.forEach((l) =>
      l({
        data: {
          channel: "ador-game",
          id: sent.at(-1)?.id,
          ok: true,
          result,
          version: 1,
        },
        source: host,
      }),
    );
  return { client, reply, sent };
}
const runId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";

describe("the game's side of runs", () => {
  it("asks for a run and reads the seed to play it from", async () => {
    const p = pair();
    const started = p.client.run.start();
    expect(p.sent.at(-1)).toMatchObject({ method: "run.start", params: {} });
    const result = {
      expiresAt: "2026-10-16T12:00:00.000Z",
      runId,
      seed: 4_000_000_000,
      status: "started",
    };
    p.reply(result);
    await expect(started).resolves.toEqual(result);
  });

  it("reads why there is no run", async () => {
    const p = pair();
    const started = p.client.run.start();
    p.reply({ reason: "signed-out", status: "unavailable" });
    await expect(started).resolves.toEqual({
      reason: "signed-out",
      status: "unavailable",
    });
  });

  it("submits a record for a run, and reads the verdict", async () => {
    const p = pair();
    const record = { inputs: [1, 2], seed: 5 };
    const verdict = p.client.run.submit(runId, record);
    expect(p.sent.at(-1)).toMatchObject({
      method: "run.submit",
      params: { record, runId },
    });
    p.reply({ earned: ["first-win"], status: "verified" });
    await expect(verdict).resolves.toEqual({
      earned: ["first-win"],
      status: "verified",
    });
  });

  it("refuses an answer in a shape the protocol does not allow", async () => {
    const p = pair();
    const verdict = p.client.run.submit(runId, {});
    p.reply({ earned: [], status: "maybe" });
    await expect(verdict).rejects.toMatchObject({ code: "unavailable" });
  });
});
