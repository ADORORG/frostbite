// @vitest-environment jsdom
import { installFakeAudio } from "@frostbite/game-sdk/audio/fake";
import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { soundKey } from "../src/platform/storage-keys.ts";
import { targetLength } from "../src/verifier/snake.ts";
import {
  button,
  clickButton,
  container,
  press,
  show,
  startRun,
  stat,
  status,
  ticks,
  turnPad,
} from "./support/snake-screen.tsx";
import { crashSeed } from "./snake-session.unit.test.ts";
import { playSnake, winnableSeed } from "./support/snake-solver.ts";

const seed = 1;
let audio: ReturnType<typeof installFakeAudio>;
beforeEach(() => {
  localStorage.clear();
  audio = installFakeAudio(window);
});

// Presses the key on the panel itself, which has the focus after a run is started, as a player's keyboard does.
const key = press;
// A press on the page unlocks the sound, as the first touch or key of a player does before the browser lets a page be heard.
const unlock = () =>
  act(async () => {
    window.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
  });
// A run begun the way a player does, with the sound unlocked first.
async function begin(withSeed: number) {
  await show(withSeed);
  await clickButton("Sat snake");
  await unlock();
  await clickButton("Start a run");
}
const heard = (type: string, from: number, to: number) =>
  audio.oscillators.filter(
    (voice) =>
      voice.type === type &&
      voice.frequency.calls[0]?.[1] === from &&
      voice.frequency.calls[1]?.[1] === to,
  ).length;

describe("the SAT SNAKE sound panel", () => {
  it("is at the foot of the cabinet, with music and effects each on, and gone when the cabinet is closed", async () => {
    await show(seed);
    await clickButton("Sat snake");
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.lastElementChild?.className).toBe("if-sound");
    expect(button("Music on")).toBeDefined();
    expect(button("Effects on")).toBeDefined();
    await clickButton("Close");
    expect(container.querySelector(".sound-panel")).toBeNull();
  });

  it("keeps the player's choice for the next time the cabinet is opened", async () => {
    await show(seed);
    await clickButton("Sat snake");
    await clickButton("Music on");
    expect(JSON.parse(localStorage.getItem(soundKey) ?? "null")).toMatchObject({
      music: false,
    });
    await clickButton("Close");
    await clickButton("Sat snake");
    expect(button("Music off")).toBeDefined();
    expect(button("Effects on")).toBeDefined();
  });

  it("starts with the defaults when what was saved is not readable", async () => {
    localStorage.setItem(soundKey, "{not json");
    await show(seed);
    await clickButton("Sat snake");
    expect(button("Music on")).toBeDefined();
  });

  it("still works when the storage refuses the choice", async () => {
    await show(seed);
    await clickButton("Sat snake");
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("full");
    };
    try {
      await clickButton("Music on");
      expect(button("Music off")).toBeDefined();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe("the SAT SNAKE keys", () => {
  it("start a run on Enter from the panel, and do not throw away a run that is going", async () => {
    await show(seed);
    await clickButton("Sat snake");
    await key("Enter");
    expect(stat("Length")).toBe("3");
    await ticks(2);
    await key("Enter");
    expect(stat("Moves")).toBe("2");
  });

  it("pause on P and on Space: the snake stands still, the page says so, and it moves on after", async () => {
    await startRun(seed);
    await ticks(2);
    for (const code of ["p", " "]) {
      const before = stat("Moves");
      await key(code);
      expect(button("Resume")).toBeDefined();
      expect(status()).toContain("Paused");
      await ticks(3);
      expect(stat("Moves")).toBe(before);
      await key(code);
      expect(button("Pause")).toBeDefined();
      await ticks(1);
      expect(Number(stat("Moves"))).toBe(Number(before) + 1);
    }
  });

  it("pause from the button, and refuse a turn while paused", async () => {
    await startRun(seed);
    await clickButton("Pause");
    expect(button("Resume")).toBeDefined();
    await key("ArrowUp");
    await turnPad("right");
    await clickButton("Resume");
    await clickButton("End run");
    const text =
      container.querySelector<HTMLTextAreaElement>(".if-record-text")?.value ??
      "";
    expect(text).not.toContain('"turn"');
  });

  it("move the focus to the panel when a run starts, so the keys land", async () => {
    await show(seed);
    await clickButton("Sat snake");
    // The button that is pressed holds the focus, and goes when the run starts.
    button("Start a run")?.focus();
    await clickButton("Start a run");
    expect(document.activeElement).toBe(
      container.querySelector('[role="dialog"]'),
    );
  });

  it("leave Enter and Space to a button that has the focus, which the browser presses itself", async () => {
    await show(seed);
    await clickButton("Sat snake");
    const startButton = button("Start a run");
    await act(async () => {
      startButton?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
    });
    expect(stat("Length")).toBeUndefined();
    await clickButton("Start a run");
    const pauseButton = button("Pause");
    await act(async () => {
      pauseButton?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: " " }),
      );
    });
    expect(button("Pause")).toBeDefined();
  });

  it("lift a pause when another run is started", async () => {
    await startRun(seed);
    await clickButton("Pause");
    await clickButton("End run");
    await clickButton("Start another run");
    expect(button("Pause")).toBeDefined();
    await ticks(2);
    expect(stat("Moves")).toBe("2");
  });

  it("start another run on Enter once one has ended, with the pause lifted", async () => {
    await startRun(crashSeed);
    await key("ArrowUp");
    await ticks(40);
    expect(container.querySelector(".if-record")).not.toBeNull();
    await key("Enter");
    expect(stat("Moves")).toBe("0");
    expect(button("Pause")).toBeDefined();
  });
});

describe("the SAT SNAKE sounds", () => {
  it("play the start sound once a key has unlocked the sound, and music while the run goes", async () => {
    await show(seed);
    await clickButton("Sat snake");
    expect(audio.oscillators).toHaveLength(0);
    await unlock();
    await key("Enter");
    expect(heard("square", 392, 392)).toBe(1);
    const early = audio.oscillators.length;
    await ticks(10);
    expect(audio.oscillators.length).toBeGreaterThan(early);
  });

  it("tick for a turn, bite for each cell grown, and stop the music when the run ends", async () => {
    const winning = winnableSeed(targetLength);
    const won = playSnake(winning, targetLength);
    if (won === null) throw new Error("The test player could not win.");
    await begin(winning);
    for (let tick = 0; tick < won.state.tick; tick += 1) {
      for (const turn of won.turns.filter((t) => t.tick === tick))
        await turnPad(turn.dir);
      await ticks(1);
    }
    expect(heard("square", 440, 520)).toBeGreaterThan(0);
    expect(heard("square", 660, 1320)).toBe(targetLength - 3);
    await clickButton("End run");
    const ended = audio.oscillators.length;
    await ticks(10);
    expect(audio.oscillators).toHaveLength(ended);
  });

  it("crash with a tumble", async () => {
    await begin(crashSeed);
    await key("ArrowUp");
    await ticks(40);
    expect(heard("sawtooth", 330, 110)).toBe(1);
  });

  it("make no tumble when the player ends a run that was going well", async () => {
    await begin(seed);
    await clickButton("End run");
    expect(heard("sawtooth", 330, 110)).toBe(0);
  });

  it("go quiet while paused", async () => {
    await begin(seed);
    await key("p");
    expect(audio.state).toBe("suspended");
    await key("p");
    expect(audio.state).toBe("running");
  });

  it("make no sound for a turn that was refused", async () => {
    await begin(seed);
    const before = heard("square", 440, 520);
    await key("ArrowUp");
    await key("a");
    expect(heard("square", 440, 520)).toBe(before + 1);
  });
});
