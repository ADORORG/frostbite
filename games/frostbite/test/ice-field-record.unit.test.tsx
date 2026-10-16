// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  clearBoard,
  clickButton,
  clickTile,
  container,
  safeTiles,
  seed,
  seeds,
  startRun,
  status,
} from "./support/screen.tsx";

const recordText = () =>
  container.querySelector<HTMLTextAreaElement>(".if-record-text")?.value ?? "";

describe("ending a run", () => {
  it("shows the record of what was played: the steps, the seed, the claims, and the record itself", async () => {
    await startRun();
    await clearBoard(0);
    await clickButton("Settle board");
    await clickButton("Build glacier");
    await clickButton("End run");
    const summary = container.querySelector(".if-record")?.textContent ?? "";
    // 20 picks, a settle and a glacier.
    expect(summary).toContain(`22 steps from seed ${String(seed)}.`);
    expect(summary).toContain("Claims: first-win, first-glacier.");
    const record = JSON.parse(recordText());
    expect(record).toMatchObject({
      claims: ["first-win", "first-glacier"],
      config: { cabinet: "ice-field", mines: 5 },
      gameId: "frostbite",
      seed,
      verifier: "frostbite",
      verifierVersion: 2,
    });
    expect(record.inputs).toHaveLength(22);
    expect(record.inputs.at(-2)).toEqual({ type: "settle" });
    expect(record.inputs.at(-1)).toEqual({ data: 1, type: "build-glacier" });
  });

  it("is the canonical text, with its keys sorted and no spaces, so the platform measures and hashes it as is", async () => {
    await startRun();
    await clickTile(safeTiles()[0] ?? 0);
    await clickButton("End run");
    const text = recordText();
    expect(
      text.startsWith(
        '{"claims":[],"config":{"cabinet":"ice-field","mines":5},"gameId":"frostbite"',
      ),
    ).toBe(true);
    expect(text).not.toMatch(/\s/u);
  });

  it("says no milestone was earned when none was, and does not list a claim", async () => {
    await startRun();
    await clickButton("End run");
    const summary = container.querySelector(".if-record")?.textContent ?? "";
    expect(summary).toContain("0 steps");
    expect(summary).toContain("No milestone was earned in this run.");
    expect(summary).not.toContain("Claims:");
  });

  it("never calls a run verified when none was sent to the platform: the milestones are the player's own claim", async () => {
    await startRun();
    await clearBoard(0);
    await clickButton("Settle board");
    await clickButton("End run");
    const text = container.textContent ?? "";
    expect(text).toContain(
      "Milestones earned here are your own claim: this run was not sent to the platform to be checked.",
    );
    expect(text).not.toMatch(/verified/iu);
  });

  it("starts another run with a new seed and a clean board, and keeps the old record out of the way", async () => {
    await startRun();
    await clickTile(safeTiles()[0] ?? 0);
    await clickButton("End run");
    await clickButton("Start another run");
    expect(seeds).toHaveBeenCalledTimes(2);
    expect(container.querySelector(".if-record")).toBeNull();
    expect(
      container.querySelectorAll(".if-tile[data-state='open']"),
    ).toHaveLength(25);
    expect(status()).toContain("Pick a tile. A mine ends the board.");
  });

  it("selects the whole record when the box is focused, for copying by hand", async () => {
    await startRun();
    await clickButton("End run");
    const box = container.querySelector<HTMLTextAreaElement>(".if-record-text");
    expect(box?.readOnly).toBe(true);
    box?.focus();
    expect(box?.selectionStart).toBe(0);
    expect(box?.selectionEnd).toBe(box?.value.length);
  });
});

describe("what the frame allows", () => {
  it("uses no inline styles anywhere on the screen, which the frame's policy forbids", async () => {
    await startRun();
    await clickTile(safeTiles()[0] ?? 0);
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
    await clickButton("End run");
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
  });
});
