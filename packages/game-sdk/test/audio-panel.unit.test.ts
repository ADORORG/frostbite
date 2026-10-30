// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { createSound } from "../src/audio/engine.ts";
import { mountSoundPanel, panelCopy } from "../src/audio/panel.ts";
import { defaultSound } from "../src/audio/settings.ts";
import { FakeContext, manualTimer } from "./support/fake-audio.ts";

afterEach(() => document.body.replaceChildren());

function setup(settings = defaultSound) {
  const context = new FakeContext();
  const sound = createSound({
    context: () => context,
    settings,
    timer: manualTimer(),
  });
  const container = document.createElement("div");
  document.body.append(container);
  const saved: number[] = [];
  const unmount = mountSoundPanel(container, sound, {
    onChange: () => saved.push(saved.length),
  });
  const pick = (key: string) =>
    container.querySelector<HTMLButtonElement>(`[data-sound="${key}"]`);
  return { container, context, pick, saved, sound, unmount };
}

const keyDown = (code: string) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { code }));

describe("the sound panel", () => {
  it("is a labelled group with music and effects buttons, a volume, and the state in words", () => {
    const { container, pick } = setup();
    const group = container.querySelector(".sound-panel");
    expect(group?.getAttribute("role")).toBe("group");
    expect(group?.getAttribute("aria-label")).toBe(panelCopy.group);
    expect(pick("music")?.textContent).toBe("Music on");
    expect(pick("music")?.getAttribute("aria-pressed")).toBe("true");
    expect(pick("effects")?.textContent).toBe("Effects on");
    expect(pick("music")?.title).toBe(panelCopy.musicTitle);
    const volume = container.querySelector("input");
    expect(volume?.getAttribute("aria-label")).toBe(panelCopy.volume);
    expect(volume?.value).toBe("60");
  });

  it("shows what was saved, not the defaults", () => {
    const { container, pick } = setup({
      effects: false,
      music: false,
      volume: 0.25,
    });
    expect(pick("music")?.textContent).toBe("Music off");
    expect(pick("music")?.getAttribute("aria-pressed")).toBe("false");
    expect(pick("effects")?.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector("input")?.value).toBe("25");
  });

  it("says sound waits for a key until the player acts, then says nothing", async () => {
    const { container, sound } = setup();
    const hint = container.querySelector(".sound-panel__hint");
    expect(hint?.textContent).toBe(panelCopy.waiting);
    expect(hint?.getAttribute("role")).toBe("status");
    keyDown("KeyX");
    await sound.unlock();
    await Promise.resolve();
    expect(hint?.textContent).toBe("");
  });

  it("says so when the browser cannot play sound", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const sound = createSound({
      context: () => {
        throw new Error("none");
      },
    });
    mountSoundPanel(container, sound);
    window.dispatchEvent(new Event("pointerdown"));
    await sound.unlock();
    await new Promise((resolve) => setTimeout(resolve));
    expect(container.querySelector(".sound-panel__hint")?.textContent).toBe(
      panelCopy.unavailable,
    );
  });

  it("turns music and effects off and on from the buttons, tells the game to save, and unlocks sound with the press", () => {
    const { context, pick, saved, sound } = setup();
    pick("music")?.click();
    expect(sound.state().settings.music).toBe(false);
    expect(pick("music")?.textContent).toBe("Music off");
    expect(pick("music")?.getAttribute("aria-pressed")).toBe("false");
    expect(sound.state().settings.effects).toBe(true);
    pick("effects")?.click();
    pick("effects")?.click();
    expect(sound.state().settings.effects).toBe(true);
    expect(saved).toHaveLength(3);
    expect(context.gains.length).toBe(3);
  });

  it("sets the volume from the slider", () => {
    const { container, sound, saved } = setup();
    const volume = container.querySelector("input");
    if (volume === null) throw new Error("no slider");
    volume.value = "35";
    volume.dispatchEvent(new Event("input"));
    expect(sound.state().settings.volume).toBeCloseTo(0.35);
    expect(saved).toHaveLength(1);
  });

  it("turns music off and on with M and effects with N", () => {
    const { pick, sound } = setup();
    keyDown("KeyM");
    expect(sound.state().settings.music).toBe(false);
    expect(pick("music")?.textContent).toBe("Music off");
    keyDown("KeyN");
    expect(sound.state().settings.effects).toBe(false);
    keyDown("KeyM");
    expect(sound.state().settings.music).toBe(true);
  });

  it("acts on the press of M and N, not on the release", () => {
    const { sound } = setup();
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyM" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyN" }));
    expect(sound.state().settings).toEqual(defaultSound);
  });

  it("unlocks sound on the first press anywhere, and wakes it again after the browser suspends it", async () => {
    const { context, sound } = setup();
    window.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    await Promise.resolve();
    expect(sound.state().unlocked).toBe(true);
    expect(context.calls).toEqual(["resume"]);
    context.state = "suspended";
    keyDown("KeyX");
    await Promise.resolve();
    await Promise.resolve();
    expect(context.calls).toEqual(["resume", "resume"]);
  });

  it("goes away, and stops listening, when unmounted", () => {
    const { container, sound, unmount } = setup();
    unmount();
    expect(container.querySelector(".sound-panel")).toBeNull();
    keyDown("KeyM");
    expect(sound.state().settings.music).toBe(true);
    window.dispatchEvent(new Event("pointerdown"));
    expect(sound.state().unlocked).toBe(false);
  });

  it("works without a save callback", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const sound = createSound({ context: () => new FakeContext() });
    mountSoundPanel(container, sound);
    container.querySelector<HTMLButtonElement>('[data-sound="music"]')?.click();
    expect(sound.state().settings.music).toBe(false);
  });
});
