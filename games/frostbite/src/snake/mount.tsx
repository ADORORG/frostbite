import * as React from "react";
import { createRoot } from "react-dom/client";

import { cabinetDock } from "../cabinet/dock.ts";
import type { CabinetHost } from "../cabinet/host.ts";
import { SatSnake } from "./snake-cabinet.tsx";

// Puts the cabinet on the page, in a root of its own beside the game's and the ice field's. Returns a function that takes it
// off again.
export function mountSatSnake(
  host: CabinetHost,
  options: {
    document?: Document;
    newSeed?: () => number;
    tickMs?: number;
  } = {},
): () => void {
  const page = options.document ?? document;
  const element = page.createElement("div");
  element.id = "sat-snake-root";
  cabinetDock(page).append(element);
  const root = createRoot(element);
  root.render(
    <SatSnake host={host} newSeed={options.newSeed} tickMs={options.tickMs} />,
  );
  return () => {
    root.unmount();
    element.remove();
  };
}
