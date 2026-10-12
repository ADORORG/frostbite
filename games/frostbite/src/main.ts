import { createGameClient } from "@ador/game-sdk/client";
import { createPlatformStorage } from "@ador/game-sdk/storage-shim";
import * as React from "react";
import * as ReactDOM from "react-dom/client";

import { createMilestoneBridge } from "./platform/milestone-bridge.ts";
import { persistedKeys } from "./platform/storage-keys.ts";

// FROST·BITE on the platform. The game was written for a plain page with React from a CDN, `localStorage` and a
// house server. Here it is one bundle: this file gives it what it expects (React, a storage, a way to report
// milestones) from the platform, then starts the game's own code (src/legacy). It makes no request of its own.
declare global {
  interface Window {
    FrostbiteHost: { milestone(mark: string): void };
    React: typeof React;
    ReactDOM: typeof ReactDOM;
  }
}

async function start(): Promise<void> {
  const client = createGameClient();
  // A page opened outside the platform has no host to answer; the game then plays with nothing kept.
  await client.ready().catch(() => undefined);
  const storage = await createPlatformStorage({ client, persistedKeys });
  // The frame has no storage of its own, so asking for it would throw; the game gets this one.
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  const bridge = await createMilestoneBridge(client);
  window.FrostbiteHost = { milestone: bridge.report };
  window.React = React;
  window.ReactDOM = ReactDOM;
  // What the player did last is saved when they leave, not a second later.
  window.addEventListener("pagehide", () => void storage.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void storage.flush();
  });
  await import("./legacy-boot.ts");
}

void start();
