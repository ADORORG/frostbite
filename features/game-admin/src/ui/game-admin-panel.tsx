"use client";

import { ArcadeInfoCard } from "@repo/ui/arcade";
import { useMemo } from "react";

import { createGameAdminApi, type GameAdminApi } from "../client/api.ts";
import type { AdminGameInfo } from "../game-info.ts";
import { ActivityLog } from "./activity-log.tsx";
import { ClaimsSection } from "./claims-section.tsx";
import { ContractSection } from "./contract-section.tsx";
import { MilestoneList } from "./milestone-list.tsx";
import { SignerBar } from "./signer-bar.tsx";
import { isStarting } from "./starting.ts";
import { StepSheet } from "./step-sheet.tsx";
import { useAdminSteps, type StepSigner } from "./use-admin-steps.ts";
import { useSigner } from "./use-signer.ts";

// One game's rewards contract, for staff: create it once the templates are published, then pause and resume claims, define
// milestones, review and sign each step, and the log of what has been done. The wallet address is whichever staff will sign with;
// the auth-token output is for networks whose steps must present the game's token.
export function GameAdminPanel({
  api: injected,
  game,
  sign,
  pollMs,
  connectedAddress,
}: {
  readonly api?: GameAdminApi;
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
  const ask = (action: Parameters<typeof admin.start>[0]) =>
    signer.ready ? admin.start(action, signer.context) : Promise.resolve();
  const { overview, starting } = admin;
  if (overview === null || overview.kind !== "game")
    return (
      <ArcadeInfoCard title="Rewards contract">
        <p role="status">{admin.message ?? "Loading this game's contract…"}</p>
      </ArcadeInfoCard>
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
        <>
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
        </>
      ) : null}
      <ActivityLog onOpen={admin.reopen} steps={admin.steps} />
      <StepSheet admin={admin} />
    </>
  );
}
