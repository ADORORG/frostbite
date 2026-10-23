import type { StartGameAdminStepResponse } from "@ador/shared/games";
import { vi } from "vitest";

// An API whose start does not answer until the test lets it, so what the page shows while it waits can be looked at.
export function slowStart() {
  let answer: (value: StartGameAdminStepResponse) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const start = vi.fn(
    () =>
      new Promise<StartGameAdminStepResponse>((resolve, reject) => {
        answer = resolve;
        fail = reject;
      }),
  );
  return {
    answer: (value: StartGameAdminStepResponse) => answer(value),
    fail: (error: Error) => fail(error),
    start,
  };
}
export const sheet = (container: HTMLElement) =>
  container.querySelector<HTMLDialogElement>("dialog");
export const sheetTitle = (container: HTMLElement) =>
  sheet(container)?.querySelector("h2")?.textContent ?? "";
