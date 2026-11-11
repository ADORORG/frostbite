import type { CheckProfileNameResponse } from "@frostbite/shared/profiles";
import { useEffect, useState } from "react";

import type { ProfileApi } from "../client/profile-api.ts";
import type { NameCheckState } from "../domain/name-status.ts";

// How long the player stops typing before the name is asked about: long enough not to ask on every key, short enough to feel live.
export const nameCheckDelayMs = 350;

// Asks whether a name is free once the player pauses, and answers for the name as it is now: an answer about an earlier spelling is never
// taken for this one's. While nothing needs asking (`skip`: the name is empty, malformed, or already the player's own) it asks nothing.
export function useNameCheck(
  api: ProfileApi,
  name: string,
  skip: boolean,
): NameCheckState {
  const [answered, setAnswered] = useState<{
    readonly name: string;
    readonly result: CheckProfileNameResponse | null;
  } | null>(null);
  useEffect(() => {
    if (skip) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .checkName(name, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setAnswered({ name, result });
        })
        .catch(() => {
          if (!controller.signal.aborted) setAnswered({ name, result: null });
        });
    }, nameCheckDelayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, name, skip]);
  if (skip) return { kind: "idle" };
  if (answered?.name !== name) return { kind: "checking" };
  return answered.result === null
    ? { kind: "failed" }
    : { kind: "result", result: answered.result };
}
