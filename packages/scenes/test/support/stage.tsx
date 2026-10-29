import { act } from "react";

import { ScenesProvider, AnimationToggle } from "../../src/react/index.ts";
import { blocks } from "../../src/library/blocks.ts";
import { runner } from "../../src/library/runner.ts";
import { installBrowser } from "./browser.ts";

// A provider with a switch above a positioned box, and the small reads every scene test makes of what was rendered.
export const stage = (children: React.ReactNode, list = [blocks, runner]) => (
  <ScenesProvider list={list}>
    <AnimationToggle />
    <div style={{ position: "relative" }}>{children}</div>
  </ScenesProvider>
);
export const toggle = (container: HTMLElement) =>
  container.querySelector("button");
export const canvases = (container: HTMLElement) => [
  ...container.querySelectorAll("canvas"),
];
export const frameAt =
  (browser: ReturnType<typeof installBrowser>) =>
  async (milliseconds: number) => {
    await act(async () => browser.tick(milliseconds));
  };
