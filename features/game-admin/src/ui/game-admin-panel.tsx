"use client";

import { ArcadeInfoCard } from "@repo/ui/arcade";
import { useCallback, useMemo, type ReactNode } from "react";

import { createGameAdminApi, type GameAdminApi } from "../client/api.ts";
import type { AdminGameInfo } from "../game-info.ts";
import { ActivityLog } from "./activity-log.tsx";
import { BatchDrawings } from "./batch-drawings.tsx";
import { ClaimsSection } from "./claims-section.tsx";
import { ContractSection } from "./contract-section.tsx";
import { MilestoneList } from "./milestone-list.tsx";
import { SignerBar } from "./signer-bar.tsx";
import { isPreparing, isStarting } from "./starting.ts";
import { StepSheet } from "./step-sheet.tsx";
import { useAdminSteps, type StepSigner } from "./use-admin-steps.ts";
import { useBatchQueue } from "./use-batch-queue.ts";
import { useSigner } from "./use-signer.ts";

// One game's rewards contract, for staff: create it once the templates are published, then pause and resume claims, define
// milestones, review and sign each step, and the log of what has been done. What the page shows about the game's mints (`children`) sits
// above the log and the milestones: the milestones can be many, so they come last, in a box of their own. The wallet address is whichever staff will sign with;
// the auth-token output is for networks whose steps must present the game's token.
export function GameAdminPanel({
  api: injected,
  game,
  sign,
  pollMs,
  connectedAddress,
  children,
}: {
  readonly api?: GameAdminApi;
  readonly children?: ReactNode;
  readonly game: AdminGameInfo;
  readonly pollMs?: number;
  readonly sign?: StepSigner;
  // The connected wallet's address, offered as the one to sign with.
  readonly connectedAddress?: string;
}) {
  const api = useMemo(() => injected ?? createGameAdminApi(), [injected]);
  const admin = useAdminSteps({
    api,
    gameId: game.id,
    ...(pollMs === undefined ? {} : { pollMs }),
    ...(sign === undefined ? {} : { sign }),
  });
  const signer = useSigner(connectedAddress);
  const { start } = admin;
  const ask = useCallback(
    (action: Parameters<typeof start>[0]) =>
      signer.ready ? start(action, signer.context) : Promise.resolve(),
    [signer.context, signer.ready, start],
  );
  const queue = useBatchQueue({ admin, ask });
  const { overview, starting } = admin;
  if (overview === null || overview.kind !== "game")
    return (
      <>
        <ArcadeInfoCard title="Rewards contract">
          <p role="status">
            {admin.message ?? "Loading this game's contract…"}
          </p>
        </ArcadeInfoCard>
        {children}
      </>
    );
  // A step cannot be started while no one is named to sign it, or while another is being prepared.
  const busy = !signer.ready || starting !== null;
  const hasContract = overview.contract !== null;
  const pause = { operation: "set-claims-paused", paused: true } as const;
  const resume = { operation: "set-claims-paused", paused: false } as const;
  return (
    <>
      <SignerBar
        canSign={sign !== undefined}
        signer={signer}
        withAuthToken={hasContract}
      />
      {admin.message !== null && admin.active === null && starting === null ? (
        <p role="alert">{admin.message}</p>
      ) : null}
      <ContractSection
        address={overview.contract?.address ?? null}
        busy={busy}
        drawingCeiling={overview.drawingCeiling}
        maxDrawingBytes={overview.contract?.maxDrawingBytes ?? null}
        onCreate={(maxDrawingBytes) =>
          void ask({ maxDrawingBytes, operation: "deploy" })
        }
        preparing={isStarting(starting, {
          maxDrawingBytes: overview.drawingCeiling,
          operation: "deploy",
        })}
        templatesReady={overview.templatesReady}
      />
      {hasContract ? (
        <ClaimsSection
          busy={busy}
          onChange={(paused) =>
            void ask({ operation: "set-claims-paused", paused })
          }
          preparing={
            isStarting(starting, pause)
              ? "pause"
              : isStarting(starting, resume)
                ? "resume"
                : null
          }
          steps={admin.steps}
        />
      ) : null}
      {children}
      <ActivityLog onOpen={admin.reopen} steps={admin.steps} />
      {overview.contract !== null ? (
        <BatchDrawings
          // A run that stopped at a refusal is continued from the batch itself, so only a step being prepared holds it back.
          busy={!signer.ready || isPreparing(starting)}
          milestones={game.milestones}
          policy={{
            ...overview.drawingLimits,
            maxBytes: overview.contract.maxDrawingBytes,
          }}
          queue={queue}
          steps={admin.steps}
        />
      ) : null}
      {hasContract ? (
        <MilestoneList
          busy={busy}
          milestones={game.milestones}
          onDefine={(milestoneId, drawing) =>
            void ask({ drawing, milestoneId, operation: "define-milestone" })
          }
          preparing={
            game.milestones.find((milestone) =>
              isStarting(starting, {
                milestoneId: milestone.id,
                operation: "define-milestone",
              }),
            )?.id ?? null
          }
          steps={admin.steps}
        />
      ) : null}
      <StepSheet admin={admin} />
    </>
  );
}
