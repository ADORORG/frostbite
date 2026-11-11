import { type DrawingPolicy } from "@frostbite/milestone-art";
import type { GameAdminStep } from "@frostbite/shared/games";
import {
  ArcadeActionButton,
  ArcadeFileDrop,
  SectionBlock,
} from "@repo/ui/arcade";
import { useMemo, useState } from "react";

import { batchCopy } from "../domain/batch-copy.ts";
import { planBatch, type DrawingFile } from "../domain/batch-drawings.ts";
import { isDefined } from "../domain/definitions.ts";
import type { AdminGameInfo } from "../game-info.ts";
import { BatchRows } from "./batch-rows.tsx";
import type { BatchQueue } from "./use-batch-queue.ts";

// Define many milestones from a folder of drawings: every drawing is checked against the rules the platform will hold it to before
// anything is started, then the milestones are defined one after another, each step reviewed and signed in the usual way.
export function BatchDrawings({
  busy,
  milestones,
  policy,
  queue,
  steps,
}: {
  readonly busy: boolean;
  readonly milestones: AdminGameInfo["milestones"];
  readonly policy: DrawingPolicy;
  readonly queue: BatchQueue;
  readonly steps: readonly GameAdminStep[];
}) {
  const [files, setFiles] = useState<readonly DrawingFile[]>([]);
  const { rows, unmatched } = useMemo(
    () =>
      planBatch({
        defined: new Set(
          milestones.map(({ id }) => id).filter((id) => isDefined(steps, id)),
        ),
        files,
        milestones,
        policy,
      }),
    [files, milestones, policy, steps],
  );
  const ready = rows.flatMap((row) =>
    row.state === "ready"
      ? [{ drawing: row.drawing, milestoneId: row.milestoneId }]
      : [],
  );
  const stopped = rows.find(
    ({ milestoneId }) => milestoneId === queue.stoppedAt,
  );
  return (
    <SectionBlock description={batchCopy.description} title={batchCopy.title}>
      <ArcadeFileDrop
        accept=".svg,image/svg+xml"
        disabled={queue.running}
        hint={batchCopy.dropHint}
        label={batchCopy.dropLabel}
        onFiles={(chosen) =>
          void Promise.all(
            chosen.map(async (file) => ({
              name: file.name,
              text: await file.text(),
            })),
          ).then(setFiles)
        }
      />
      {files.length === 0 ? null : (
        <>
          <p role="status">
            {queue.running
              ? batchCopy.running
              : stopped !== undefined
                ? batchCopy.stoppedAt(stopped.title)
                : batchCopy.ready(ready.length)}
          </p>
          {unmatched.length === 0 ? null : (
            <p role="alert">{batchCopy.unmatched(unmatched)}</p>
          )}
          <BatchRows rows={rows} steps={steps} />
          {queue.running ? (
            <ArcadeActionButton onClick={queue.pause} size="small">
              {batchCopy.pause}
            </ArcadeActionButton>
          ) : stopped !== undefined ? (
            <ArcadeActionButton
              disabled={busy}
              onClick={queue.resume}
              size="small"
              tone="mint"
            >
              {batchCopy.resume}
            </ArcadeActionButton>
          ) : (
            <ArcadeActionButton
              disabled={busy || ready.length === 0}
              onClick={() => queue.start(ready)}
              size="small"
              tone="mint"
            >
              {batchCopy.start(ready.length)}
            </ArcadeActionButton>
          )}
        </>
      )}
    </SectionBlock>
  );
}
