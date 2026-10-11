import { ArcadeActionButton, StatusLamp } from "@repo/ui/arcade";
import type { ReactNode } from "react";

import type { LoadedResource } from "../hooks/use-resource.ts";

// One piece of a page that loads on its own: it says when it is loading, says when it failed and offers a
// retry, and keeps showing what it already had after a failed refresh. A slow or failed piece never
// hides the rest of the page.
export function Loadable<Data>({
  children,
  label,
  resource,
}: {
  readonly children: (data: Data) => ReactNode;
  // What is loading, as a noun phrase: "your collections".
  readonly label: string;
  readonly resource: LoadedResource<Data>;
}) {
  const { state } = resource;
  if (state.status === "ready") return children(state.data);
  if (state.status === "loading")
    return <StatusLamp label={`Loading ${label}…`} tone="attention" />;
  return (
    <>
      <StatusLamp
        label={
          state.data === null
            ? `Could not load ${label}.`
            : `Could not refresh ${label}. Showing what was loaded earlier.`
        }
        tone="unavailable"
      />
      <div className="arcade-actions">
        <ArcadeActionButton onClick={resource.reload} tone="yellow">
          Retry
        </ArcadeActionButton>
      </div>
      {state.data === null ? null : children(state.data)}
    </>
  );
}
