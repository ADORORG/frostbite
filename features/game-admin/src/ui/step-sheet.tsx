"use client";

import {
  ActionProgress,
  ArcadeActionButton,
  ArcadeDialog,
  ArcadeSignButton,
} from "@repo/ui/arcade";
import { useState } from "react";

import { operationLabel } from "../domain/copy.ts";
import { StepReview } from "./step-review.tsx";
import type { AdminSteps } from "./use-admin-steps.ts";

// Where a step is carried out, in one place whatever the step is: a sheet that opens the moment an action is asked for, says it is
// being prepared, then becomes the step's review to sign from, and stays to follow the step, so a person is never left looking at a
// page that has done nothing. An action that could not be started says why here, where it was asked for. Closing it leaves the step
// in the log.
export function StepSheet({ admin }: { readonly admin: AdminSteps }) {
  const [pasted, setPasted] = useState("");
  const { active, starting } = admin;
  const review = starting === null ? active : null;
  const title =
    starting !== null
      ? starting.label
      : active === null
        ? ""
        : operationLabel(active);
  return (
    <ArcadeDialog
      footer={
        review === null ||
        review.toSign === null ? undefined : admin.canSign ? (
          <ArcadeSignButton
            onClick={() => void admin.sign()}
            working={admin.working}
          />
        ) : (
          <ArcadeActionButton
            disabled={admin.working}
            onClick={() => void admin.sendPasted(pasted)}
            tone="mint"
          >
            {admin.working ? "Sending…" : "Send signed transaction"}
          </ArcadeActionButton>
        )
      }
      onClose={admin.dismiss}
      open={starting !== null || active !== null}
      title={title}
      wide
    >
      {starting !== null ? (
        starting.failure === null ? (
          <ActionProgress
            detail="Reading the chain for its fees and a free address, and building the transaction. Nothing is sent, and nothing is signed yet."
            title="Preparing the step…"
          />
        ) : (
          <p role="alert">{starting.failure}</p>
        )
      ) : review === null ? null : (
        <StepReview
          canSign={admin.canSign}
          message={admin.message}
          onPaste={setPasted}
          onRecord={(address) => void admin.record(address)}
          pasted={pasted}
          step={review}
          working={admin.working}
        />
      )}
    </ArcadeDialog>
  );
}
