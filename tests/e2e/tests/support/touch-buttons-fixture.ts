import { attachTouchButtons } from "@frostbite/game-sdk/touch-buttons";

// A page with a screen and three action buttons, which writes what happens to `window.log`, for the layout spec.
const log: string[] = [];
Reflect.set(window, "log", log);
const main = document.querySelector("main");
const screen = document.querySelector("canvas");
if (main === null || screen === null) throw new Error("no page");
screen.addEventListener("pointerdown", () => void log.push("screen"));
attachTouchButtons(
  main,
  ["Fire", "Next", "Help"].map((label) => ({
    label,
    press: () => void log.push(`press ${label}`),
    release: () => void log.push(`release ${label}`),
  })),
);
