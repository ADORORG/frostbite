import { installFakeAudio } from "@ador/game-sdk/audio/fake";
import { afterEach, describe, expect, it } from "vitest";

import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// The keys, the pause and the sound of Snowball Dash's page: the same in every game, and played here through the real page.
async function opened(saved: Parameters<typeof play>[0] = { best: 0 }) {
  const { stored, window } = await play(saved);
  await settle();
  const press = (code: string) =>
    window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
  const text = (id: string) => window.document.getElementById(id)?.textContent;
  const el = (id: string) => window.document.getElementById(id);
  return { el, press, stored, text, window };
}

describe("Snowball Dash's keys, pause and sound", () => {
  it("starts a run on Enter once it has connected, and not before", async () => {
    const { window } = await play();
    const press = (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
    const start = window.document.getElementById("start");
    press("Enter");
    expect(start?.hasAttribute("hidden")).toBe(false);
    await settle();
    press("Enter");
    await settle(100);
    expect(start?.hasAttribute("hidden")).toBe(true);
    expect(
      window.document.getElementById("pause")?.hasAttribute("disabled"),
    ).toBe(false);
  });

  it("does not start a run on Enter while the platform has not answered yet", async () => {
    const { window } = await play(undefined, {
      loadProgress: () => new Promise(() => undefined),
    });
    await settle();
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    await settle(100);
    expect(
      window.document.getElementById("start")?.hasAttribute("hidden"),
    ).toBe(false);
  });

  it("hops on Enter, Space and a touch while a run goes, and Enter never throws the run away", async () => {
    const { window } = await play({ best: 0 });
    const audio = installFakeAudio(window);
    await settle();
    const press = (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
    const hops = () =>
      audio.oscillators.filter(({ frequency }) =>
        frequency.calls.some(([, value]) => value === 640),
      ).length;
    press("Enter");
    await settle(150);
    expect(hops()).toBe(0);
    press("Enter");
    expect(hops()).toBe(1);
    await settle(800);
    press("Space");
    expect(hops()).toBe(2);
    await settle(800);
    window.document
      .getElementById("screen")
      ?.dispatchEvent(new window.MouseEvent("pointerdown"));
    expect(hops()).toBe(3);
    expect(
      window.document.getElementById("start")?.hasAttribute("hidden"),
    ).toBe(true);
  }, 15_000);

  it("plays the music while a run goes, and none for a hop made while paused", async () => {
    const { window } = await play({ best: 0 });
    const audio = installFakeAudio(window);
    await settle();
    const send = (code: string) =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
    const hops = () =>
      audio.oscillators.filter(({ frequency }) =>
        frequency.calls.some(([, value]) => value === 640),
      ).length;
    expect(audio.oscillators).toHaveLength(0);
    send("Enter");
    await settle(150);
    const started = audio.oscillators.length;
    expect(started).toBeGreaterThan(0);
    await settle(400);
    expect(audio.oscillators.length).toBeGreaterThan(started);
    send("Space");
    expect(hops()).toBe(1);
    send("KeyP");
    expect(audio.state).toBe("suspended");
    send("Space");
    expect(hops()).toBe(1);
    send("KeyP");
    expect(audio.state).toBe("running");
  }, 15_000);

  it("stops the music when the run ends", async () => {
    const { window } = await play({ best: 0 });
    const audio = installFakeAudio(window);
    await settle();
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    await settle(3_800);
    expect(
      window.document.getElementById("start")?.hasAttribute("hidden"),
    ).toBe(false);
    const ended = audio.oscillators.length;
    await settle(500);
    expect(audio.oscillators).toHaveLength(ended);
  }, 15_000);

  it("ignores P when no run is going", async () => {
    const { press, text } = await opened();
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    expect(text("note")).toBe("");
  });

  it("pauses on P: the run stands still, the page says so, and it carries on from where it was", async () => {
    const { press, text } = await opened();
    press("Enter");
    await settle(400);
    press("KeyP");
    const frozen = text("distance");
    expect(text("pause")).toBe("Resume");
    expect(text("note")).toContain("Paused");
    await settle(400);
    expect(text("distance")).toBe(frozen);
    press("KeyP");
    expect(text("pause")).toBe("Pause");
    expect(text("note")).not.toContain("Paused");
    await settle(500);
    expect(Number(text("distance"))).toBeGreaterThan(Number(frozen));
  }, 15_000);

  it("pauses from its button too, and Space is the hop, not the pause", async () => {
    const { el, press, text, window } = await opened();
    el("start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    press("Space");
    expect(text("pause")).toBe("Pause");
    el("pause")?.dispatchEvent(new window.MouseEvent("click"));
    expect(text("pause")).toBe("Resume");
  });

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
