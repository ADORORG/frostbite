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
  const deliver = (data: unknown) =>
    listeners.forEach((l) => l({ data, source: host }));
  const reply = (result: unknown) =>
    deliver({
      channel: "frostbite-game",
      id: sent.at(-1)?.id,
      ok: true,
      result,
      version: 1,
    });
  return { client, deliver, reply, sent };
}

describe("the game's side of claims", () => {
  it("asks the platform to start a claim of a milestone and reads that it was requested", async () => {
    const p = pair();
    const asked = p.client.milestones.claim("first-win");
    expect(p.sent.at(-1)).toMatchObject({
      method: "milestones.claim",
      params: { id: "first-win" },
    });
    p.reply({ status: "requested" });
    await expect(asked).resolves.toEqual({ status: "requested" });
  });

  it("reads why a claim cannot start", async () => {
    const p = pair();
    const asked = p.client.milestones.claim("first-win");
    p.reply({ reason: "no-wallet", status: "unavailable" });
    await expect(asked).resolves.toEqual({
      reason: "no-wallet",
      status: "unavailable",
    });
  });

  it("refuses an answer that is not one the protocol allows", async () => {
    const p = pair();
    const asked = p.client.milestones.claim("first-win");
    p.reply({ status: "minted" });
    await expect(asked).rejects.toThrow();
  });

  it("hears how a claim goes, and nothing the protocol does not allow", () => {
    const p = pair();
    const heard: unknown[] = [];
    const stop = p.client.on("claim.changed", (data) => heard.push(data));
    const event = (data: unknown) => ({
      channel: "frostbite-game",
      data,
      event: "claim.changed",
      version: 1,
    });
    p.deliver(event({ id: "first-win", state: "pending" }));
    p.deliver(event({ id: "first-win", state: "minted" }));
    p.deliver(event({ id: "first-win", state: "complete", tx: "abc" }));
    expect(heard).toEqual([{ id: "first-win", state: "pending" }]);
    stop();
    p.deliver(event({ id: "first-win", state: "complete" }));
    expect(heard).toHaveLength(1);
  });
});
