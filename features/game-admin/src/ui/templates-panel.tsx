"use client";

import { ArcadeInfoCard, SectionBlock } from "@repo/ui/arcade";
import { useMemo } from "react";

import { createGameAdminApi, type GameAdminApi } from "../client/api.ts";
import { isSettledStep } from "../domain/copy.ts";
import { ActivityLog } from "./activity-log.tsx";
import { isStarting } from "./starting.ts";
import { SignerBar } from "./signer-bar.tsx";
import { StepSheet } from "./step-sheet.tsx";
import { TemplateTile } from "./template-tile.tsx";
import { useAdminSteps, type StepSigner } from "./use-admin-steps.ts";
import { useSigner } from "./use-signer.ts";

const ref = (template: { id: string; version: string }) =>
  `${template.id}@${template.version}`;

// The templates the platform publishes, for staff: which are on the chain and where, and a way to publish each that is not. Staff
// do not choose the address the code is published at: the platform finds one nothing is at and nothing else is set to use, and the
// review shows it. The step is reviewed and signed like any other, and the template is recorded only when it completes.
export function TemplatesPanel({
  api: injected,
  pollMs,
  sign,
  connectedAddress,
}: {
  readonly api?: GameAdminApi;
  readonly pollMs?: number;
  readonly sign?: StepSigner;
  // The connected wallet's address, offered as the one to sign with.
  readonly connectedAddress?: string;
}) {
  const api = useMemo(() => injected ?? createGameAdminApi(), [injected]);
  const admin = useAdminSteps({
    api,
    gameId: null,
    ...(pollMs === undefined ? {} : { pollMs }),
    ...(sign === undefined ? {} : { sign }),
  });
  const signer = useSigner(connectedAddress);
  const { overview } = admin;
  if (overview === null || overview.kind !== "templates")
    return (
      <ArcadeInfoCard title="Templates">
        <p role="status">{admin.message ?? "Loading the templates…"}</p>
      </ArcadeInfoCard>
    );
  const where = new Map(
    overview.published.map(({ address, templateRef }) => [
      templateRef,
      address,
    ]),
  );
  return (
    <>
      <SignerBar
        canSign={sign !== undefined}
        signer={signer}
        withAuthToken={false}
      />
      {admin.message !== null &&
      admin.active === null &&
      admin.starting === null ? (
        <p role="alert">{admin.message}</p>
      ) : null}
      <SectionBlock
        description="The code every game's rewards contract is made from. Each is published once, then reused."
        title="Templates"
      >
        <ul aria-label="Templates" className="tile-grid">
          {overview.publishable.map((template) => {
            const key = ref(template);
            const action = {
              operation: "publish-template",
              templateId: template.id,
              templateVersion: template.version,
            } as const;
            return (
              <TemplateTile
                address={where.get(key)}
                busy={!signer.ready || admin.starting !== null}
                key={key}
                onOpen={admin.reopen}
                onPublish={() => void admin.start(action, signer.context)}
                preparing={isStarting(admin.starting, action)}
                step={admin.steps.find(
                  (step) =>
                    step.templateRef === key && !isSettledStep(step.state),
                )}
                template={template}
              />
            );
          })}
        </ul>
      </SectionBlock>
      <ActivityLog
        empty="No template has been published yet."
        onOpen={admin.reopen}
        steps={admin.steps}
        title="Template log"
      />
      <StepSheet admin={admin} />
    </>
  );
}
