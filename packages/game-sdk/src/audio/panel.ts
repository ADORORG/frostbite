import { attachKeys } from "../controls.ts";
import type { Sound } from "./engine.ts";

// The sound controls a player sees in every game: music and effects each on or off, a volume, and a line that says honestly when
// nothing can be heard yet. M turns the music off and on, N the effects. A press anywhere on the page unlocks sound, since a browser
// keeps a page silent until then, and wakes it again after an interruption. Style it with `@import "@ador/game-sdk/audio/panel.css"`.
export const panelCopy = {
  group: "Sound",
  music: "Music",
  musicTitle: "Music (M)",
  effects: "Effects",
  effectsTitle: "Sound effects (N)",
  off: "off",
  on: "on",
  unavailable: "This browser cannot play sound.",
  volume: "Volume",
  waiting: "Sound starts when you press a key.",
} as const;

export interface PanelOptions {
  // Called after any change the player makes, to save the settings (the game keeps them beside its progress).
  readonly onChange?: () => void;
}

function button(title: string, key: string) {
  const made = document.createElement("button");
  made.type = "button";
  made.dataset.sound = key;
  made.title = title;
  return made;
}

export function mountSoundPanel(
  container: HTMLElement,
  sound: Sound,
  options: PanelOptions = {},
): () => void {
  const group = document.createElement("div");
  group.className = "sound-panel";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", panelCopy.group);
  const music = button(panelCopy.musicTitle, "music");
  const effects = button(panelCopy.effectsTitle, "effects");
  const volume = document.createElement("input");
  volume.type = "range";
  volume.min = "0";
  volume.max = "100";
  volume.step = "5";
  volume.setAttribute("aria-label", panelCopy.volume);
  const hint = document.createElement("span");
  hint.className = "sound-panel__hint";
  hint.setAttribute("role", "status");
  group.append(music, effects, volume, hint);
  container.replaceChildren(group);

  const refresh = (): void => {
    const { available, settings, unlocked } = sound.state();
    for (const [control, name, on] of [
      [music, panelCopy.music, settings.music],
      [effects, panelCopy.effects, settings.effects],
    ] as const) {
      control.setAttribute("aria-pressed", String(on));
      control.textContent = `${name} ${on ? panelCopy.on : panelCopy.off}`;
    }
    volume.value = String(Math.round(settings.volume * 100));
    hint.textContent = !available
      ? panelCopy.unavailable
      : unlocked
        ? ""
        : panelCopy.waiting;
  };

  const change = (next: Parameters<Sound["configure"]>[0]): void => {
    void sound.unlock();
    sound.configure(next);
    refresh();
    options.onChange?.();
  };
  const flip = (which: "effects" | "music"): void =>
    change({ [which]: !sound.state().settings[which] });

  music.addEventListener("click", () => flip("music"));
  effects.addEventListener("click", () => flip("effects"));
  volume.addEventListener("input", () =>
    change({ volume: Number(volume.value) / 100 }),
  );
  // Every press asks again: a browser may suspend the context (a call, a locked phone) and it takes a press to wake it.
  const unlock = (): void => void sound.unlock().then(refresh);
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  const detachKeys = attachKeys(
    window,
    { KeyM: "music", KeyN: "effects" } as const,
    (action, phase) => {
      if (phase === "down") flip(action);
    },
  );
  refresh();
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    detachKeys();
    group.remove();
  };
}
