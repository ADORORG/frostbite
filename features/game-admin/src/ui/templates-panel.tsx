"use client";

import {
  ArcadeActionButton,
  ArcadeInfoCard,
  ArcadeTextField,
} from "@repo/ui/arcade";
import { useMemo, useState } from "react";

import { createGameAdminApi, type GameAdminApi } from "../client/api.ts";
import { SignerCard, useSigner } from "./signer-card.tsx";
import { StepLog } from "./step-log.tsx";
import { StepReview } from "./step-review.tsx";
import { useAdminSteps, type StepSigner } from "./use-admin-steps.ts";

const ref = (template: { id: string; version: string }) =>
  `${template.id}@${template.version}`;

// The templates the platform publishes, for staff: which are on the chain and where, and a way to publish each that is not. Staff
// choose the address the code is published at; it is checked against the chain's records and cannot be used twice. The step is
// reviewed and signed like any other, and the template is recorded only when it completes.
export function TemplatesPanel({
  api: injected,
  pollMs,
  sign,
}: {
  readonly api?: GameAdminApi;
  readonly pollMs?: number;
  readonly sign?: StepSigner;
}) {
  const api = useMemo(() => injected ?? createGameAdminApi(), [injected]);
  const admin = useAdminSteps({
    api,
    gameId: null,
    ...(pollMs === undefined ? {} : { pollMs }),
    ...(sign === undefined ? {} : { sign }),
  });
  const signer = useSigner();
  const [addresses, setAddresses] = useState<Readonly<Record<string, string>>>(
    {},
  );
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
      <SignerCard signer={signer} withAuthToken={false} />
      <ArcadeInfoCard title="Templates">
        <ul aria-label="Templates">
          {overview.publishable.map((template) => {
            const key = ref(template);
            const published = where.get(key);
            const address = addresses[key] ?? "";
            return (
              <li data-template={key} key={key}>
                <strong>{key}</strong> —{" "}
                {published === undefined ? (
                  <span>Not published</span>
                ) : (
                  <span>{`Published at ${published}`}</span>
                )}
                {published !== undefined ? null : (
                  <>
                    <ArcadeTextField
                      hint="Where on the chain to publish it, as block:tx. It must be an address nothing else uses."
                      label={`Address for ${key}`}
                      onChange={(value) =>
                        setAddresses((held) => ({ ...held, [key]: value }))
                      }
                      value={address}
                    />
                    <ArcadeActionButton
                      disabled={!signer.ready || address.trim() === ""}
                      onClick={() =>
                        void admin.start(
                          {
                            address: address.trim(),
                            operation: "publish-template",
                            templateId: template.id,
                            templateVersion: template.version,
                          },
                          signer.context,
                        )
                      }
                      tone="mint"
                    >
                      {`Publish ${key}`}
                    </ArcadeActionButton>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </ArcadeInfoCard>
      {admin.message !== null && admin.active === null ? (
        <p role="alert">{admin.message}</p>
      ) : null}
      {admin.active === null ? null : (
        <StepReview
          canSign={admin.canSign}
          message={admin.message}
          onClose={admin.dismiss}
          onRecord={(address) => void admin.record(address)}
          onSendPasted={(payload) => void admin.sendPasted(payload)}
          onSign={() => void admin.sign()}
          step={admin.active}
          working={admin.working}
        />
      )}
      <StepLog
        empty="No template has been published yet."
        onOpen={admin.reopen}
        steps={admin.steps}
        title="Template log"
      />
    </>
  );
}
