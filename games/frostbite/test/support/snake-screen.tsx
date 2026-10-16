import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, vi, type Mock } from "vitest";

import type { CabinetHost } from "../../src/cabinet/host.ts";
import { SatSnake } from "../../src/snake/snake-cabinet.tsx";

// A harness for the SAT SNAKE screen in jsdom with a clock that only moves when the test moves it. The host is a spy and
// the seed is given, and every helper acts the way a player does.
export const host: { milestone: Mock<(mark: string) => void> } = {
  milestone: vi.fn(),
};
export const tickMs = 100;
export let container: HTMLElement;
let root: Root;

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  host.milestone.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

export const show = (seed: number, platform: CabinetHost = host) =>
  act(async () => {
    root.render(
      <SatSnake host={platform} newSeed={() => seed} tickMs={tickMs} />,
    );
  });
export const button = (name: string) =>
  [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.includes(name),
  );
export const click = (element: Element | undefined | null) =>
  act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
export const clickButton = (name: string) => click(button(name));
export const turnPad = (direction: string) =>
  click(container.querySelector(`[data-direction="${direction}"]`));
export const press = (key: string) =>
  act(async () => {
    (document.activeElement ?? container).dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }),
    );
  });
export const ticks = (count: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(tickMs * count);
  });
export const status = () =>
  container.querySelector('[role="status"]')?.textContent ?? "";
export const stat = (name: string) =>
  [...container.querySelectorAll(".if-stats div")]
    .find((row) => row.querySelector("dt")?.textContent === name)
    ?.querySelector("dd")?.textContent;
export const recordText = () =>
  container.querySelector<HTMLTextAreaElement>(".if-record-text")?.value ?? "";
export const startRun = async (seed: number, platform?: CabinetHost) => {
  await show(seed, platform);
  await clickButton("Sat snake");
  await clickButton("Start a run");
};
