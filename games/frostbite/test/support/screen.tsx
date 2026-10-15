import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, vi, type Mock } from "vitest";

import { IceField, type IceFieldHost } from "../../src/ice-field/ice-field.tsx";
import {
  cells,
  defaultMines,
  iceFieldMines,
} from "../../src/verifier/ice-field.ts";

// A harness for the cabinet's screen in jsdom: the host is a spy, the seed is fixed, and every helper acts the way a
// player does (clicks, reads what is on screen).
export const seed = 20_261_017;
export const host: { milestone: Mock<(mark: string) => void> } = {
  milestone: vi.fn(),
};
export const seeds: Mock<() => number> = vi.fn(() => seed);
export let container: HTMLElement;
let root: Root;

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  host.milestone.mockClear();
  seeds.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

export const show = (platform: IceFieldHost = host) =>
  act(async () => {
    root.render(<IceField host={platform} newSeed={seeds} />);
  });
export const mines = (board = 0) => iceFieldMines(seed, board, defaultMines);
export const safeTiles = (board = 0) =>
  Array.from({ length: cells }, (_, tile) => tile).filter(
    (tile) => !mines(board).includes(tile),
  );

export const button = (name: string) =>
  [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.includes(name),
  );
export const click = (element: Element | undefined | null) =>
  act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
export const clickButton = (name: string) => click(button(name));
export const tile = (index: number) =>
  container.querySelector<HTMLButtonElement>(
    `.if-tile[aria-label^="Tile ${String(index + 1)} of"]`,
  );
export const clickTile = (index: number) => click(tile(index));
export const status = () =>
  container.querySelector('[role="status"]')?.textContent ?? "";
export const panel = () =>
  container.querySelector<HTMLElement>('[role="dialog"]');
export const press = (key: string) =>
  act(async () => {
    (document.activeElement ?? container).dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key }),
    );
  });

export const open = async (platform?: IceFieldHost) => {
  await show(platform);
  await clickButton("Ice field");
};
export const startRun = async (platform?: IceFieldHost) => {
  await open(platform);
  await clickButton("Start a run");
};
export const clearBoard = async (board = 0) => {
  for (const index of safeTiles(board)) await clickTile(index);
};
