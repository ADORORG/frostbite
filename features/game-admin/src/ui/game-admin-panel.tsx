"use client";

import { ArcadeInfoCard } from "@repo/ui/arcade";
import { useMemo } from "react";

import { createGameAdminApi, type GameAdminApi } from "../client/api.ts";
import type { AdminGameInfo } from "../game-info.ts";
import { ContractCard } from "./contract-card.tsx";
import { MilestoneTable } from "./milestone-table.tsx";
import { PauseCard } from "./pause-card.tsx";
import { SignerCard, useSigner } from "./signer-card.tsx";
import { StepLog } from "./step-log.tsx";
import { StepReview } from "./step-review.tsx";
import { useAdminSteps, type StepSigner } from "./use-admin-steps.ts";

// One game's rewards contract, for staff: create it once the templates are published, then pause and resume claims, define
// milestones, review and sign each step, and the log of what has been done. The wallet address is whichever staff will sign with;
// the auth-token output is for networks whose steps must present the game's token.
export function GameAdminPanel({
  api: injected,
  game,
  sign,
  pollMs,
}: {
  readonly api?: GameAdminApi;
  readonly game: AdminGameInfo;
  readonly pollMs?: number;
  readonly sign?: StepSigner;
}) {
  const api = useMemo(() => injected ?? createGameAdminApi(), [injected]);
  const admin = useAdminSteps({
    api,
    gameId: game.id,
    ...(pollMs === undefined ? {} : { pollMs }),
    ...(sign === undefined ? {} : { sign }),
  });
  const signer = useSigner();
  const ask = (action: Parameters<typeof admin.start>[0]) =>
    signer.ready ? admin.start(action, signer.context) : Promise.resolve();
  const { overview } = admin;
  if (overview === null || overview.kind !== "game")
    return (
      <ArcadeInfoCard title="Rewards contract">
        <p role="status">{admin.message ?? "Loading this game's contract…"}</p>
      </ArcadeInfoCard>
    );
  const hasContract = overview.contract !== null;
  return (
    <>
      <SignerCard signer={signer} withAuthToken={hasContract} />
      {admin.message !== null && admin.active === null ? (
        <p role="alert">{admin.message}</p>
      ) : null}
      {overview.contract === null ? (
        <ContractCard
          busy={!signer.ready}
          drawingCeiling={overview.drawingCeiling}
          onCreate={(maxDrawingBytes) =>
            void ask({ maxDrawingBytes, operation: "deploy" })
          }
          templatesReady={overview.templatesReady}
        />
      ) : (
        <>
          <ArcadeInfoCard title="Rewards contract">
            <p data-testid="contract-address">{`Contract ${overview.contract.address}. It keeps drawings up to ${overview.contract.maxDrawingBytes} bytes.`}</p>
          </ArcadeInfoCard>
          <PauseCard
            busy={!signer.ready}
            onChange={(paused) =>
              void ask({ operation: "set-claims-paused", paused })
            }
            steps={admin.steps}
          />
          <MilestoneTable
            busy={!signer.ready}
            milestones={game.milestones}
            onDefine={(milestoneId, drawing) =>
              void ask({ drawing, milestoneId, operation: "define-milestone" })
            }
            steps={admin.steps}
          />
        </>
      )}
      {admin.active === null ? null : (
        <StepReview
          canSign={admin.canSign}
          message={admin.message}
          onClose={admin.dismiss}
          onSendPasted={(payload) => void admin.sendPasted(payload)}
          onSign={() => void admin.sign()}
          step={admin.active}
          working={admin.working}
        />
      )}
      <StepLog onOpen={admin.reopen} steps={admin.steps} />
    </>
  );
}
