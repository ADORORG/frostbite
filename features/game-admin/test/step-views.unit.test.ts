import { gameAdminStepStates } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import { stateTone } from "../src/domain/copy.ts";
import { shortTime, stepFacts } from "../src/domain/facts.ts";
import { lifecycleSteps } from "../src/domain/lifecycle.ts";

const marks = (state: Parameters<typeof lifecycleSteps>[0]["state"]) =>
  lifecycleSteps({ delayed: false, state }).map(
    (step) => `${step.label}:${step.state}`,
  );

describe("a step's life as stages", () => {
  it("has built it and waits for the signature while it awaits one", () => {
    expect(marks("awaiting-signature")).toEqual([
      "Built:done",
      "Signed:active",
      "Sent:pending",
      "Confirmed:pending",
      "Indexed:pending",
    ]);
  });

  it("has signed and sent it, and waits for a block, while it is sent", () => {
    expect(marks("pending")).toEqual([
      "Built:done",
      "Signed:done",
      "Sent:done",
      "Confirmed:active",
      "Indexed:pending",
    ]);
  });

  it("waits only for the network's records once it is in a block, and is all done when they show it", () => {
    expect(marks("confirmed")).toEqual([
      "Built:done",
      "Signed:done",
      "Sent:done",
      "Confirmed:done",
      "Indexed:active",
    ]);
    expect(marks("complete")).toEqual([
      "Built:done",
      "Signed:done",
      "Sent:done",
      "Confirmed:done",
      "Indexed:done",
    ]);
  });

  it("stops after being built when it failed or ran out of time, and says which", () => {
    expect(marks("failed")).toEqual(["Built:done", "Failed:failed"]);
    expect(marks("expired")).toEqual(["Built:done", "Expired:failed"]);
  });

  it("tells, on the stage it waits at, what it waits for, and says so when it is taking longer than expected", () => {
    const waiting = lifecycleSteps({ delayed: false, state: "pending" });
    expect(waiting[3]?.detail).toBe("Sent, waiting");
    const late = lifecycleSteps({ delayed: true, state: "pending" });
    expect(late[3]?.detail).toBe("Sent, delayed");
    expect(late[0]?.detail).toBeUndefined();
  });

  it("is told for every state there is", () => {
    for (const state of gameAdminStepStates)
      expect(marks(state).length).toBeGreaterThan(1);
  });
});

describe("a state's colour", () => {
  it("has one for every state, and tells waiting on you from waiting on the network from done from stopped", () => {
    expect(Object.keys(stateTone).sort()).toEqual(
      [...gameAdminStepStates].sort(),
    );
    expect(stateTone["awaiting-signature"]).toBe("yellow");
    expect(stateTone.pending).toBe("cyan");
    expect(stateTone.complete).toBe("mint");
    expect(stateTone.failed).toBe("red");
    expect(stateTone.expired).toBe("pink");
  });
});

describe("a time for a person", () => {
  it("is the day, the month and the minute in UTC, padded", () => {
    expect(shortTime("2026-10-23T19:06:27.000Z")).toBe("23 Oct 19:06 UTC");
    expect(shortTime("2026-01-05T03:04:00.000Z")).toBe("5 Jan 03:04 UTC");
    expect(shortTime("2026-12-31T23:59:59.000Z")).toBe("31 Dec 23:59 UTC");
  });
});

const base = {
  chain: "bip122:00000000da84f2bafbbc53dee25a72ae",
  expiresAt: "2026-10-23T19:36:27.000Z",
  fee: { asset: "btc", baseUnits: "37691" },
};

describe("what a step does, as facts", () => {
  const facts = (summary: Parameters<typeof stepFacts>[0]["summary"]) =>
    stepFacts({ summary }).filter(({ value }) => value !== undefined);

  it("says the network and when it is valid until for any step, and nothing it has no value for", () => {
    expect(facts(base).map(({ label, value }) => [label, value])).toEqual([
      ["Network", base.chain],
      ["Valid until", "23 Oct 19:36 UTC"],
    ]);
  });

  it("tells a template publish by the template and where it will be", () => {
    const rows = facts({
      ...base,
      template: { address: "4:1000", id: "game-rewards", version: "1.0.0" },
    });
    expect(rows.map(({ label, value }) => [label, value])).toContainEqual([
      "Template",
      "game-rewards 1.0.0",
    ]);
    expect(rows.find(({ label }) => label === "Published at")).toMatchObject({
      mono: true,
      value: "4:1000",
    });
  });

  it("tells a contract creation, a definition and a pause by what each sets", () => {
    const rows = facts({
      ...base,
      claimLimit: 3,
      collectibleAddress: "4:1001",
      contractId: "2:7",
      drawing: { bytes: 120, sha256: "a".repeat(64) },
      maxDrawingBytes: 8192,
      paused: false,
    });
    const byLabel = new Map(rows.map(({ label, value }) => [label, value]));
    expect(byLabel.get("Rewards contract")).toBe("2:7");
    expect(byLabel.get("Collectibles are made from the template at")).toBe(
      "4:1001",
    );
    expect(byLabel.get("Largest drawing the contract will keep")).toBe(
      "8192 bytes",
    );
    expect(byLabel.get("Claims allowed per wallet")).toBe(3);
    expect(byLabel.get("Drawing")).toBe("120 bytes, aaaaaaaaaaaa…");
    expect(byLabel.get("Claims will be")).toBe("open");
    expect(
      facts({ ...base, paused: true }).find(
        ({ label }) => label === "Claims will be",
      )?.value,
    ).toBe("paused");
  });
});
