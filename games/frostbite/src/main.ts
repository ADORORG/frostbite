import { createGameClient } from "@frostbite/game-sdk/client";
import { jsonValueSchema } from "@frostbite/game-sdk/protocol";
import { canonicalJson, type RunRecord } from "@frostbite/game-sdk/run-record";
import { createPlatformStorage } from "@frostbite/game-sdk/storage-shim";
import * as React from "react";
import * as ReactDOM from "react-dom/client";

import type { CabinetHost } from "./cabinet/host.ts";
import { mountIceField } from "./ice-field/mount.tsx";
import { mountSatSnake } from "./snake/mount.tsx";
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
  // The replayable cabinets, beside the game: each in a root of its own, with its own rules, no legacy file touched.
  const cabinetHost: CabinetHost = {
    milestone: bridge.report,
    runs: {
      // Outside the platform, or for a player it cannot give a run, a cabinet plays on a local seed.
      start: () =>
        client.run
          .start()
          .catch(() => ({ reason: "not-supported", status: "unavailable" })),
      submit: (runId: string, record: RunRecord) =>
        client.run.submit(
          runId,
          jsonValueSchema.parse(JSON.parse(canonicalJson(record))),
        ),
    },
  };
  mountIceField(cabinetHost);
  mountSatSnake(cabinetHost);
}

void start();
