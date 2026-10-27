"use client";

import { useResource, type Resource } from "@ador/client-react";
import { useEffect } from "react";

// A value the platform is asked for when the page opens and then every `refreshMs` while the tab shows. A failed ask keeps the last
// good value (see `holdReading`); it is the caller that decides how long that stays of use.
export function usePolled<Data>(
  load: (signal: AbortSignal) => Promise<Data>,
  key: string,
  refreshMs: number,
): Resource<Data, "unreachable"> {
  const { reload, state } = useResource(
    load,
    key,
    () => "unreachable" as const,
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) reload();
    }, refreshMs);
    return () => clearInterval(timer);
  }, [reload, refreshMs]);
  return state;
}
