import * as React from "react";
import { createRoot } from "react-dom/client";

import { IceField, type IceFieldHost } from "./ice-field.tsx";

// Puts the cabinet on the page, in a root of its own beside the game's, so it needs nothing from the game's code and no
// legacy file is touched. Returns a function that takes it off again.
export function mountIceField(
  host: IceFieldHost,
  options: { document?: Document; newSeed?: () => number } = {},
): () => void {
  const page = options.document ?? document;
  const element = page.createElement("div");
  element.id = "ice-field-root";
  page.body.append(element);
  const root = createRoot(element);
  root.render(<IceField host={host} newSeed={options.newSeed} />);
  return () => {
    root.unmount();
    element.remove();
  };
}
