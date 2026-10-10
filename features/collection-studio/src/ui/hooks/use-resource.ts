import { useCallback, useEffect, useRef, useState } from "react";

import { describeFailure, type Failure } from "../../client/error-copy.ts";

export type Resource<Data> =
  | { readonly status: "loading" }
  | { readonly data: Data; readonly status: "ready" }
  // `data` is the last good value, kept so a failed reload does not blank the screen.
  | {
      readonly data: Data | null;
      readonly failure: Failure;
      readonly status: "error";
    };

export interface LoadedResource<Data> {
  readonly reload: () => void;
  // Puts a value the page already holds (for example a save's response) in place of the loaded one.
  readonly replace: (data: Data) => void;
  readonly state: Resource<Data>;
}

// Loads a value when it mounts and whenever `key` changes, and again on `reload`. A newer load
// supersedes an older one, and an unmounted page never receives a late response.
export function useResource<Data>(
  load: (signal: AbortSignal) => Promise<Data>,
  key: string,
): LoadedResource<Data> {
  const [state, setState] = useState<Resource<Data>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const lastGood = useRef<Data | null>(null);
  const loadRef = useRef(load);

  // Kept current in an effect (declared first, so it runs first) rather than during render.
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    loadRef
      .current(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        lastGood.current = data;
        setState({ data, status: "ready" });
      })
      // A caught value is `unknown`; `describeFailure` narrows it.
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: lastGood.current,
          failure: describeFailure(error),
          status: "error",
        });
      });
    return () => controller.abort();
  }, [key, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  const replace = useCallback((data: Data) => {
    lastGood.current = data;
    setState({ data, status: "ready" });
  }, []);
  return { reload, replace, state };
}
