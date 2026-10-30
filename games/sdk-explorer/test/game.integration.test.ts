import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript } from "@ador/game-sdk/build";
import type { HostedGame } from "@ador/game-sdk/host";
import { createMemoryGameBackend } from "@ador/test-kit/memory-game-backend";
import {
  runGameInSimulatedHost,
  type SimulatedGame,
} from "@ador/test-kit/simulated-game-host";
import { afterEach, describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const address =
  "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv";
const manifest = (capabilities: string[]): HostedGame => ({
  capabilities,
  id: "sdk-explorer",
  milestones: [
    {
      claimPolicy: "repeatable",
      criteria: "Call it.",
      description: "Called.",
      id: "first-call",
      maxCount: 5,
      title: "First call",
    },
    {
      claimPolicy: "once",
      criteria: "Ten presses.",
      description: "Ten.",
      id: "ten-presses",
      target: 10,
      title: "Ten presses",
    },
  ],
});
const settle = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

let running: SimulatedGame | undefined;
afterEach(() => running?.close());

async function open(capabilities: string[]) {
  const memory = createMemoryGameBackend();
  running = runGameInSimulatedHost({
    backend: memory.backend,
    game: manifest(capabilities),
    html: await readFile(join(root, "index.html"), "utf8"),
    script: await bundleGameScript(join(root, "src/main.ts")),
    services: {
      toast: () => undefined,
      wallet: () => ({ address, network: "signet" }),
    },
  });
  await settle();
  const { document } = running.window;
  const press = async (id: string) => {
    document
      .getElementById(id)
      ?.dispatchEvent(new running!.window.Event("click"));
    await settle();
  };
  const lines = () =>
    [...document.querySelectorAll("#log li")].map((item) => item.textContent);
  return { document, lines, memory, press };
}

describe("the SDK explorer, bundled and run against a simulated platform", () => {
  it("connects, and offers a button for each call only once it has", async () => {
    const { document } = await open(["wallet"]);
    expect(document.getElementById("status")?.textContent).toBe(
      "Connected. Call anything below.",
    );
    const buttons = [...document.querySelectorAll("#probes button")];
    // A button for each of the 15 calls, and the sandbox check.
    expect(buttons).toHaveLength(16);
    expect(buttons.every((button) => !button.hasAttribute("disabled"))).toBe(
      true,
    );
  });

  it("checks the frame's isolation and says what happened to each thing a game must not do", async () => {
    const { lines, press } = await open([]);
    await press("sandbox");
    expect(lines()[0]).toMatch(
      /^sandbox check → \{"cookie":"(?:allowed|blocked)","fetch":"(?:allowed|blocked)","localStorage":"(?:allowed|blocked)"\}$/u,
    );
  });

  it("shows the wallet address when it declared the capability", async () => {
    const { lines, press } = await open(["wallet"]);
    await press("wallet");
    expect(lines()[0]).toBe(
      `wallet.get → {"wallet":{"address":"${address}","network":"signet"}}`,
    );
  });

  it("asks the platform for its wallet chooser, and is told one is already connected", async () => {
    const { lines, press } = await open(["wallet"]);
    await press("wallet-connect");
    expect(lines()[0]).toBe('wallet.connect → {"status":"already-connected"}');
  });

  it("shows the refusal when asking for a wallet without declaring the capability", async () => {
    const { lines, press } = await open([]);
    await press("wallet-connect");
    expect(lines()[0]).toContain(
      "wallet.connect → refused (permission_denied)",
    );
  });

  it("asks for a run and says the platform has none to give a game with no rules to replay", async () => {
    const { lines, press } = await open(["run:submit"]);
    await press("run-start");
    expect(lines()[0]).toBe(
      'run.start → {"reason":"not-supported","status":"unavailable"}',
    );
  });

  it("shows the refusal for a run that was never issued, and the permission it needs", async () => {
    const declared = await open(["run:submit"]);
    await declared.press("run-submit");
    expect(declared.lines()[0]).toBe(
      'run.submit → {"reason":"unknown-run","status":"refused"}',
    );
    running?.close();
    const undeclared = await open([]);
    await undeclared.press("run-start");
    expect(undeclared.lines()[0]).toContain(
      "run.start → refused (permission_denied)",
    );
  });

  it("shows the refusal, not a crash, when the capability was not declared", async () => {
    const { lines, press } = await open([]);
    await press("wallet");
    expect(lines()[0]).toContain("wallet.get → refused (permission_denied)");
  });

  it("saves a counter that grows with each call, and earns its milestone", async () => {
    const { lines, memory, press } = await open(["wallet"]);
    await press("progress-save");
    await press("progress-save");
    expect(await memory.backend.loadProgress()).toEqual({ calls: 2 });
    expect(lines()[0]).toBe('progress.save → {"saved":{"calls":2}}');
    await press("milestones-unlock");
    expect(Object.keys(await memory.backend.milestones())).toEqual([
      "first-call",
    ]);
  });

  it.each([
    ["a list", [1, 2]],
    ["a word", "hello"],
    ["a counter of the wrong kind", { calls: "many" }],
    ["nothing", null],
  ])(
    "starts the counter again when the save holds %s",
    async (_what, saved) => {
      const { lines, memory, press } = await open(["wallet"]);
      await memory.backend.saveProgress(saved, new Date());
      await press("progress-save");
      expect(lines()[0]).toBe('progress.save → {"saved":{"calls":1}}');
    },
  );

  it("lists an event the platform sends on its own, apart from the answers", async () => {
    const { document, lines } = await open(["wallet"]);
    running?.host.emit("lifecycle.changed", { state: "paused" });
    await settle();
    expect(lines()[0]).toBe('event lifecycle.changed {"state":"paused"}');
    expect(
      document.querySelector('#log li[data-source="event"]'),
    ).not.toBeNull();
  });

  it("asks for a message to be shown", async () => {
    const { lines, press } = await open([]);
    await press("toast");
    expect(lines()[0]).toBe('ui.toast → {"shown":true}');
  });
});
