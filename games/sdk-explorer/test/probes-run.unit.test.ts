import { createGameClient } from "@ador/game-sdk/client";
import { createGameHost, type HostedGame } from "@ador/game-sdk/host";
import type { JsonValue } from "@ador/game-sdk/protocol";
import { createMemoryGameBackend } from "@ador/test-kit/memory-game-backend";
import { describe, expect, it } from "vitest";

import {
  attempt,
  exploredMilestone,
  probes,
  progressMilestone,
} from "../src/probes.ts";

const address =
  "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv";

// The client and the real host, joined in memory: what each probe returns is what the platform answers.
function connect(capabilities: string[]) {
  type Listener = (event: { data: unknown; source: unknown }) => void;
  const listeners = new Set<Listener>();
  const memory = createMemoryGameBackend();
  const shown: string[] = [];
  const parent = {
    postMessage: (message: unknown) => void host.handle(message),
  };
  const deliver = (data: unknown) =>
    listeners.forEach((listener) => listener({ data, source: parent }));
  const game: HostedGame = {
    capabilities,
    id: "sdk-explorer",
    milestones: [
      {
        claimPolicy: "repeatable",
        criteria: "Call it.",
        description: "Called.",
        id: exploredMilestone,
        maxCount: 5,
        title: "First call",
      },
      {
        claimPolicy: "once",
        criteria: "Ten presses.",
        description: "Ten.",
        id: progressMilestone,
        target: 10,
        title: "Ten presses",
      },
    ],
  };
  const host = createGameHost({
    backend: memory.backend,
    game,
    push: deliver,
    reply: deliver,
    services: {
      toast: (message) => void shown.push(message),
      wallet: () => ({ address, network: "signet" }),
    },
  });
  const client = createGameClient({
    host: parent,
    listenOn: {
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener),
    },
  });
  return { client, memory, shown };
}

async function run(id: string, capabilities: string[] = ["wallet"]) {
  const { client, memory, shown } = connect(capabilities);
  await client.ready();
  const probe = probes.find((candidate) => candidate.id === id);
  if (probe === undefined) throw new Error(`No probe ${id}`);
  const outcome = await attempt(() => probe.run(client));
  return { memory, outcome, shown };
}
const value = (outcome: Awaited<ReturnType<typeof run>>["outcome"]) =>
  outcome.kind === "result" ? outcome.value : outcome;

describe("each call, against the real host", () => {
  it("capabilities.get says what this game was granted", async () => {
    const { outcome } = await run("capabilities");
    expect(value(outcome)).toMatchObject({ granted: ["wallet"] });
  });

  it("player.identity gives an opaque id kept in this browser while nobody is signed in", async () => {
    const { outcome } = await run("identity");
    expect(value(outcome)).toEqual({ id: "memory-player-0001", kind: "local" });
  });

  it("player.info says nobody is signed in", async () => {
    const { outcome } = await run("player");
    expect(value(outcome)).toEqual({ signedIn: false, walletConnected: false });
  });

  it("run.start says the platform has no run for a game that publishes no rules, and is refused without the capability", async () => {
    expect(value((await run("run-start", ["run:submit"])).outcome)).toEqual({
      reason: "not-supported",
      status: "unavailable",
    });
    expect(value((await run("run-start", [])).outcome)).toMatchObject({
      code: "permission_denied",
      kind: "refused",
    });
  });

  it("run.submit shows the refusal for a run that was never issued", async () => {
    expect(value((await run("run-submit", ["run:submit"])).outcome)).toEqual({
      reason: "unknown-run",
      status: "refused",
    });
  });

  it("milestones.claim says what the page says about a claim, and is refused without the capability", async () => {
    expect(
      value((await run("milestones-claim", ["milestone:claim"])).outcome),
    ).toEqual({
      reason: "not-supported",
      status: "unavailable",
    });
    expect(value((await run("milestones-claim", [])).outcome)).toMatchObject({
      code: "permission_denied",
      kind: "refused",
    });
  });

  it("wallet.get returns the address when declared, and a refusal when not", async () => {
    expect(value((await run("wallet")).outcome)).toEqual({
      wallet: { address, network: "signet" },
    });
    expect(value((await run("wallet", [])).outcome)).toMatchObject({
      code: "permission_denied",
      kind: "refused",
    });
  });

  it("wallet.connect says a wallet is already connected when declared, and a refusal when not", async () => {
    expect(value((await run("wallet-connect")).outcome)).toEqual({
      status: "already-connected",
    });
    expect(value((await run("wallet-connect", [])).outcome)).toMatchObject({
      code: "permission_denied",
      kind: "refused",
    });
  });

  it("progress.load returns nothing before a save, and progress.save counts up", async () => {
    expect(value((await run("progress-load")).outcome)).toEqual({
      state: null,
    });
    const { client } = connect(["wallet"]);
    await client.ready();
    const save = probes.find(({ id }) => id === "progress-save");
    const results: JsonValue[] = [];
    for (let call = 0; call < 3; call += 1) {
      const outcome = await attempt(
        () => save?.run(client) ?? Promise.reject(new Error("no probe")),
      );
      results.push(value(outcome) as JsonValue);
    }
    expect(results).toEqual([
      { saved: { calls: 1 } },
      { saved: { calls: 2 } },
      { saved: { calls: 3 } },
    ]);
  });

  it.each([
    ["a word", "hello"],
    ["a list", [1]],
    ["a wrong counter", { calls: "x" }],
  ])(
    "progress.save starts the counter again when the save holds %s",
    async (_what, saved) => {
      const { client, memory } = connect(["wallet"]);
      await client.ready();
      await memory.backend.saveProgress(saved, new Date());
      const save = probes.find(({ id }) => id === "progress-save");
      const outcome = await attempt(
        () => save?.run(client) ?? Promise.reject(new Error("no probe")),
      );
      expect(value(outcome)).toEqual({ saved: { calls: 1 } });
    },
  );

  it("milestones.list shows it locked, and milestones.unlock earns it", async () => {
    expect(value((await run("milestones-list")).outcome)).toMatchObject({
      milestones: [
        { id: exploredMilestone, status: "locked" },
        { id: progressMilestone, status: "locked" },
      ],
    });
    const { memory, outcome } = await run("milestones-unlock");
    expect(value(outcome)).toMatchObject({ status: "unlocked" });
    expect(Object.keys(await memory.backend.milestones())).toEqual([
      exploredMilestone,
    ]);
  });

  it("ui.toast hands the page a message", async () => {
    const { outcome, shown } = await run("toast");
    expect(value(outcome)).toEqual({ shown: true });
    expect(shown).toEqual(["Hello from the SDK explorer"]);
  });

  it("milestones.unlock counts each press up to the manifest's maximum of five", async () => {
    const { client, memory } = connect(["wallet"]);
    await client.ready();
    const unlock = probes.find(({ id }) => id === "milestones-unlock");
    for (let press = 0; press < 7; press += 1)
      await attempt(
        () => unlock?.run(client) ?? Promise.reject(new Error("no probe")),
      );
    expect((await memory.backend.milestones())[exploredMilestone]?.count).toBe(
      5,
    );
    const counts = probes.find(({ id }) => id === "milestones-counts");
    const outcome = await attempt(
      () => counts?.run(client) ?? Promise.reject(new Error("no probe")),
    );
    expect(value(outcome)).toMatchObject({
      counts: [
        { count: 5, id: exploredMilestone, max: 5 },
        { id: progressMilestone, target: 10 },
      ],
    });
  });

  it("milestones.progress reports one more each press, and earns its milestone on the tenth", async () => {
    const { client, memory } = connect(["wallet"]);
    await client.ready();
    const press = probes.find(({ id }) => id === "milestones-progress");
    const results: JsonValue[] = [];
    for (let at = 0; at < 10; at += 1)
      results.push(
        value(
          await attempt(
            () => press?.run(client) ?? Promise.reject(new Error("no probe")),
          ),
        ) as JsonValue,
      );
    expect(results[0]).toMatchObject({
      current: 1,
      status: "locked",
      target: 10,
    });
    expect(results[8]).toMatchObject({ current: 9, status: "locked" });
    expect(results[9]).toMatchObject({ current: 10, status: "unlocked" });
    expect(Object.keys(await memory.backend.milestones())).toEqual([
      progressMilestone,
    ]);
  });
});
