import type { GameAdminAction } from "@frostbite/shared/games";
import { useCallback, useEffect, useRef, useState } from "react";

import { isSettledStep } from "../domain/copy.ts";
import { isDefined, latestDefinition } from "../domain/definitions.ts";
import type { AdminSteps } from "./use-admin-steps.ts";

export interface BatchItem {
  readonly drawing: string;
  readonly milestoneId: string;
}

// Walks a batch of milestones one at a time: it asks for the next definition only when nothing else is under way, so a step has been
// signed, sent and confirmed on the network, when its step shows Complete (the chain will not build the next from an output it has not confirmed) before the next is built.
// Where it stands is read from the log of steps, not kept here, so a reload loses nothing: choose the drawings again and the milestones
// the contract already has are skipped, and a step still waiting to be signed is simply waited for.
//
// It stops, with the milestone it stopped at, when a step this run asked for did not complete (it failed or ran out) or when the platform
// refused to start one. A step that failed before this run began is tried again.
export function useBatchQueue(options: {
  readonly admin: Pick<AdminSteps, "dismiss" | "starting" | "steps">;
  // Starts one definition, as the single-milestone button does; resolves when it became a step to review or was refused.
  readonly ask: (action: GameAdminAction) => Promise<void>;
}) {
  const { admin, ask } = options;
  const { starting, steps } = admin;
  const [items, setItems] = useState<readonly BatchItem[]>([]);
  const [wanted, setWanted] = useState(false);
  // The steps in the log when the run began: only a step after these is this run's.
  const [before, setBefore] = useState<ReadonlySet<string>>(new Set());
  // What was last asked for, and the last definition of it the log showed then, so a step that is asked for but not yet in the log is
  // not asked for twice.
  const lastAsked = useRef<{ definition: string | null; id: string } | null>(
    null,
  );
  const asking = useRef(false);

  const next = wanted
    ? items.find(({ milestoneId }) => !isDefined(steps, milestoneId))
    : undefined;
  const definition =
    next === undefined ? undefined : latestDefinition(steps, next.milestoneId);
  const failedHere =
    definition !== undefined &&
    !before.has(definition.id) &&
    isSettledStep(definition.state);
  const refused = starting !== null && starting.failure !== null;
  const stoppedAt =
    next !== undefined && (refused || failedHere) ? next.milestoneId : null;
  const running = next !== undefined && stoppedAt === null;

  const waiting = steps.some(({ state }) => !isSettledStep(state));
  useEffect(() => {
    if (!running || starting !== null || waiting || asking.current) return;
    if (next === undefined) return;
    const seen = definition?.id ?? null;
    const last = lastAsked.current;
    if (
      last !== null &&
      last.id === next.milestoneId &&
      last.definition === seen
    )
      return;
    lastAsked.current = { definition: seen, id: next.milestoneId };
    asking.current = true;
    void ask({
      drawing: next.drawing,
      milestoneId: next.milestoneId,
      operation: "define-milestone",
    }).finally(() => {
      asking.current = false;
    });
  }, [ask, definition, next, running, starting, waiting]);

  const begin = useCallback(() => {
    admin.dismiss();
    lastAsked.current = null;
    setBefore(new Set(steps.map(({ id }) => id)));
    setWanted(true);
  }, [admin, steps]);
  return {
    pause: useCallback(() => setWanted(false), []),
    resume: begin,
    running,
    start: useCallback(
      (chosen: readonly BatchItem[]) => {
        setItems(chosen);
        if (chosen.length > 0) begin();
      },
      [begin],
    ),
    stoppedAt,
  };
}

export type BatchQueue = ReturnType<typeof useBatchQueue>;
