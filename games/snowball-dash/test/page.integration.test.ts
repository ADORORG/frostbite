import { installFakeAudio } from "@frostbite/game-sdk/audio/fake";
import { afterEach, describe, expect, it } from "vitest";

import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// The one button, the pause and the sound of Snowball Dash's page: played here through the real page, bundled, with a fake speaker.
async function opened(saved: Parameters<typeof play>[0] = { best: 0 }) {
  const { stored, window } = await play(saved);
  const audio = installFakeAudio(window);
  await settle();
  const send = (type: "keydown" | "keyup", code: string) =>
    window.dispatchEvent(new window.KeyboardEvent(type, { code }));
  const el = (id: string) => window.document.getElementById(id);
  const text = (id: string) => el(id)?.textContent;
  const hops = () =>
    audio.oscillators.filter(({ frequency }) =>
      frequency.calls.some(([, value]) => value === 640),
    ).length;
  return { audio, el, hops, send, stored, text, window };
}

describe("Snowball Dash's button, pause and sound", () => {
  it("starts a run on a press once it has connected, and not before", async () => {
    const { window } = await play();
    const start = window.document.getElementById("start");
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    expect(start?.hasAttribute("hidden")).toBe(false);
    await settle();
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    await settle(100);
    expect(start?.hasAttribute("hidden")).toBe(true);
    expect(
      window.document.getElementById("pause")?.hasAttribute("disabled"),
    ).toBe(false);
  });

  it("does not start while the platform has not answered yet", async () => {
    const { window } = await play(undefined, {
      loadProgress: () => new Promise(() => undefined),
    });
    await settle();
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Space" }),
    );
    await settle(100);
    expect(
      window.document.getElementById("start")?.hasAttribute("hidden"),
    ).toBe(false);
  });

  it("starts on any press, and the press that starts a run is not a hop", async () => {
    for (const code of ["Enter", "Space", "ArrowUp"]) {
      closeGame();
      const { hops, send, el } = await opened();
      send("keydown", code);
      await settle(100);
      expect(el("start")?.hasAttribute("hidden")).toBe(true);
      expect(hops()).toBe(0);
    }
  }, 15_000);

  it("hops on a press, on Space or a touch, while a run goes, and lets go on the key coming up", async () => {
    const { hops, send, el, window } = await opened();
    send("keydown", "Enter");
    await settle(150);
    send("keyup", "Enter");
    send("keydown", "Space");
    expect(hops()).toBe(0);
    await settle(100);
    expect(hops()).toBe(1);
    send("keyup", "Space");
    await settle(800);
    el("screen")?.dispatchEvent(
      new window.MouseEvent("pointerdown", { bubbles: true }),
    );
    await settle(100);
    expect(hops()).toBe(2);
    window.dispatchEvent(new window.MouseEvent("pointerup"));
  }, 15_000);

  it("plays the music while a run goes, stops it when the run ends, and rings out a milestone", async () => {
    const { audio, send, el } = await opened();
    expect(audio.oscillators).toHaveLength(0);
    send("keydown", "Enter");
    await settle(150);
    send("keyup", "Enter");
    expect(audio.oscillators.length).toBeGreaterThan(0);
    await settle(3_800);
    expect(el("start")?.hasAttribute("hidden")).toBe(false);
    const ended = audio.oscillators.length;
    await settle(500);
    expect(audio.oscillators).toHaveLength(ended);
  }, 15_000);

  it("ignores a press made straight after a run ends, and starts another when it is made a little later", async () => {
    const { send, el } = await opened();
    send("keydown", "Enter");
    await settle(150);
    send("keyup", "Enter");
    // The moment the run ends, a player still pressing must not start the next one.
    for (
      let waited = 0;
      el("start")?.hasAttribute("hidden") && waited < 6_000;
      waited += 5
    )
      await settle(5);
    expect(el("start")?.hasAttribute("hidden")).toBe(false);
    send("keydown", "Space");
    await settle(100);
    expect(el("start")?.hasAttribute("hidden")).toBe(false);
    send("keyup", "Space");
    await settle(600);
    send("keydown", "Space");
    await settle(100);
    expect(el("start")?.hasAttribute("hidden")).toBe(true);
  }, 20_000);

  it("ignores P when no run is going", async () => {
    const { send, text } = await opened();
    send("keydown", "KeyP");
    expect(text("pause")).toBe("Pause");
    expect(text("note")).toBe("");
  });

  it("pauses on P: the run stands still, the page says so, the speaker goes quiet, and it carries on from where it was", async () => {
    const { audio, send, text } = await opened();
    send("keydown", "Enter");
    await settle(400);
    send("keyup", "Enter");
    send("keydown", "KeyP");
    expect(text("pause")).toBe("Resume");
    expect(text("note")).toContain("Paused");
    expect(audio.state).toBe("suspended");
    send("keydown", "KeyP");
    expect(text("pause")).toBe("Pause");
    expect(text("note")).not.toContain("Paused");
    expect(audio.state).toBe("running");
  }, 15_000);

  it("ignores the button while paused, and pauses from its own button too", async () => {
    const { el, hops, send, text, window } = await opened();
    el("start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    el("pause")?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Resume");
    send("keydown", "Space");
    await settle(100);
    expect(hops()).toBe(0);
    send("keyup", "Space");
  }, 15_000);

  it("keeps the sound the player chose, and saves a change with the best", async () => {
    const { stored, window } = await play({
      best: 7,
      sound: { effects: false, music: true, volume: 0.2 },
    });
    await settle();
    const music = window.document.querySelector('[data-sound="music"]');
    const effects = window.document.querySelector('[data-sound="effects"]');
    expect(music?.textContent).toBe("Music on");
    expect(effects?.textContent).toBe("Effects off");
    music?.dispatchEvent(new window.MouseEvent("click"));
    await settle();
    expect(music?.textContent).toBe("Music off");
    expect(stored.progress).toEqual({
      best: 7,
      sound: { effects: false, music: false, volume: 0.2 },
    });
  });
});
