"use client";

import { ArcadeInfoCard, ArcadeTextField } from "@repo/ui/arcade";
import { useMemo, useState } from "react";

import { createGameAdminApi, type GameAdminApi } from "../client/api.ts";
import type { AdminGameInfo } from "../game-info.ts";
import { MilestoneTable } from "./milestone-table.tsx";
import { PauseCard } from "./pause-card.tsx";
import { StepLog } from "./step-log.tsx";
import { StepReview } from "./step-review.tsx";
import { useAdminSteps, type StepSigner } from "./use-admin-steps.ts";

// One game's rewards contract, for staff: pause and resume claims, define milestones, review and sign each step, and the log of
// what has been done. The wallet address is whichever staff will sign with; the auth-token output is for networks whose steps
// must present the game's token.
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
  const [wallet, setWallet] = useState("");
  const [authToken, setAuthToken] = useState("");
  const context = { authTokenOutput: authToken.trim(), wallet: wallet.trim() };
  const ready = context.wallet !== "";
  const ask = (action: Parameters<typeof admin.start>[0]) =>
    ready ? admin.start(action, context) : Promise.resolve();
  return (
    <>
      <ArcadeInfoCard title="Who signs">
        <ArcadeTextField
          hint="The address of the wallet you will sign with."
          label="Wallet address"
          onChange={setWallet}
          required
          value={wallet}
        />
        <ArcadeTextField
          hint="Where the game's auth token is held, as txid:vout. Needed to define milestones and pause on Bitcoin."
          label="Auth token output"
          onChange={setAuthToken}
          value={authToken}
        />
        {ready ? null : <p>Enter your wallet address to start a step.</p>}
      </ArcadeInfoCard>
      {admin.message !== null && admin.active === null ? (
        <p role="alert">{admin.message}</p>
      ) : null}
      <PauseCard
        busy={!ready}
        onChange={(paused) =>
          void ask({ operation: "set-claims-paused", paused })
        }
        steps={admin.steps}
      />
      <MilestoneTable
        busy={!ready}
        milestones={game.milestones}
        onDefine={(milestoneId, drawing) =>
          void ask({ drawing, milestoneId, operation: "define-milestone" })
        }
        steps={admin.steps}
      />
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
