// @vitest-environment jsdom
import { installFakeAudio } from "@ador/game-sdk/audio/fake";
import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { soundKey } from "../src/platform/storage-keys.ts";
import {
  button,
  clearBoard,
  clickButton,
  clickTile,
  container,
  mines,
  open,
  panel,
  press,
  safeTiles,
  status,
} from "./support/screen.tsx";

let audio: ReturnType<typeof installFakeAudio>;
beforeEach(() => {
  localStorage.clear();
  audio = installFakeAudio(window);
});

// A press on the page unlocks the sound, as the first touch or key of a player does before the browser lets a page be heard.
const unlock = () =>
  act(async () => {
    window.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
  });
const heard = (type: string, from: number, to: number) =>
  audio.oscillators.filter(
    (voice) =>
      voice.type === type &&
      voice.frequency.calls[0]?.[1] === from &&
      voice.frequency.calls[1]?.[1] === to,
  ).length;
async function begin() {
  await open();
  await unlock();
  await clickButton("Start a run");
}

describe("the ice field sound panel", () => {
  it("is at the foot of the cabinet, keeps the player's choice, and goes with the cabinet", async () => {
    await open();
    expect(panel()?.lastElementChild?.className).toBe("if-sound");
    await clickButton("Effects on");
    expect(JSON.parse(localStorage.getItem(soundKey) ?? "null")).toMatchObject({
      effects: false,
    });
    await clickButton("Close");
    expect(container.querySelector(".sound-panel")).toBeNull();
    await clickButton("Ice field");
    expect(button("Effects off")).toBeDefined();
  });
});

describe("the ice field keys", () => {
  it("start a run on Enter from the panel, and leave a run that is going alone", async () => {
    await open();
    await press("Enter");
    expect(container.querySelector(".if-board")).not.toBeNull();
    await clickTile(safeTiles()[0] ?? 0);
    await press("Enter");
    expect(container.querySelector(".if-stats")?.textContent).toContain(
      "Board1",
    );
    expect(container.querySelector(".if-board")).not.toBeNull();
  });

  it("start another run on Enter once one has ended", async () => {
    await begin();
    await clickButton("End run");
    expect(container.querySelector(".if-record")).not.toBeNull();
    await press("Enter");
    expect(container.querySelector(".if-board")).not.toBeNull();
  });
});

describe("the ice field sounds", () => {
  it("play the start sound and the music, a tap for a safe tile, and a tumble for a mine", async () => {
    await begin();
    expect(heard("square", 392, 392)).toBe(1);
    const early = audio.oscillators.length;
    await clickTile(safeTiles()[0] ?? 0);
    expect(heard("sine", 520, 700)).toBe(1);
    expect(audio.oscillators.length).toBeGreaterThan(early);
    await clickTile(mines()[0] ?? 0);
    expect(heard("sawtooth", 330, 110)).toBe(1);
  });

  it("chime for a board won and for a glacier built, and are quiet for a refused pick", async () => {
    await begin();
    await clearBoard(0);
    await clickButton("Settle board");
    expect(status()).toContain("Board won");
    // The last tone of the win jingle: the start sound does not reach it.
    expect(heard("square", 1047, 1047)).toBe(1);
    await clickButton("Build glacier");
    expect(heard("square", 660, 990)).toBe(1);
    expect(heard("square", 1047, 1047)).toBe(1);
    await clickTile(safeTiles(1)[0] ?? 0);
    const taps = heard("sine", 520, 700);
    await clickTile(safeTiles(1)[0] ?? 0);
    expect(heard("sine", 520, 700)).toBe(taps);
  });

  it("do not cheer for a board that was skipped or struck", async () => {
    await begin();
    await clickButton("Settle board");
    expect(status()).toBe("Board skipped.");
    expect(heard("square", 1047, 1047)).toBe(0);
    await clickTile(mines(1)[0] ?? 0);
    await clickButton("Settle board");
    expect(status()).toBe("Mine struck: nothing banked.");
    expect(heard("square", 1047, 1047)).toBe(0);
  });

  it("do not sound a pick the rules refused", async () => {
    await begin();
    await clickTile(mines()[0] ?? 0);
    expect(heard("sawtooth", 330, 110)).toBe(1);
    await clickTile(safeTiles()[0] ?? 0);
    expect(status()).toContain("Settle");
    expect(heard("sawtooth", 330, 110)).toBe(1);
    expect(heard("sine", 520, 700)).toBe(0);
  });

  it("leave Enter to a button that has the focus, which the browser presses itself", async () => {
    await open();
    await act(async () => {
      button("Start a run")?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
    });
    expect(container.querySelector(".if-board")).toBeNull();
  });

  it("stop the music when the run ends", async () => {
    await begin();
    await clickButton("End run");
    const ended = audio.oscillators.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    });
    expect(audio.oscillators).toHaveLength(ended);
  });
});
