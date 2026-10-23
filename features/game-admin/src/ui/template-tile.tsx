import type { GameAdminStep } from "@ador/shared/games";
import { ArcadeActionButton, ArcadeBadge, Tile } from "@repo/ui/arcade";

import { stateTone, stepCopy } from "../domain/copy.ts";

// One template the platform may publish: what it is, whether it is on the chain and where, and the one thing to do about it. A
// template with a step in progress offers that step, not a second publish. The button shows the step being prepared the moment it is
// pressed.
export function TemplateTile({
  address,
  busy,
  onOpen,
  onPublish,
  preparing,
  step,
  template,
}: {
  // Where it is published, or undefined where it is not.
  readonly address: string | undefined;
  // Whether a step cannot be started now (no wallet address, or another being prepared).
  readonly busy: boolean;
  readonly onOpen: (stepId: string) => void;
  readonly onPublish: () => void;
  // This template's publish is being prepared.
  readonly preparing: boolean;
  // The step publishing it that is not over, if there is one.
  readonly step: GameAdminStep | undefined;
  readonly template: { readonly id: string; readonly version: string };
}) {
  const key = `${template.id}@${template.version}`;
  return (
    <li data-template={key}>
      <Tile
        badge={
          address !== undefined ? (
            <ArcadeBadge tone="mint">Published</ArcadeBadge>
          ) : step !== undefined ? (
            <ArcadeBadge tone={stateTone[step.state]}>
              {stepCopy(step).label}
            </ArcadeBadge>
          ) : (
            <ArcadeBadge tone="yellow">Not published</ArcadeBadge>
          )
        }
        footer={
          address !== undefined ? null : step !== undefined ? (
            <ArcadeActionButton
              ariaLabel={`Review the step publishing ${key}`}
              onClick={() => onOpen(step.id)}
              size="small"
              tone="cyan"
            >
              Review step
            </ArcadeActionButton>
          ) : (
            <ArcadeActionButton
              ariaLabel={`Publish ${key}`}
              busy={preparing}
              disabled={busy}
              onClick={onPublish}
              size="small"
              tone="mint"
            >
              {preparing ? "Preparing…" : "Publish"}
            </ArcadeActionButton>
          )
        }
        title={template.id}
      >
        <p>{`Version ${template.version}`}</p>
        {address === undefined ? (
          <p>Not on the chain yet.</p>
        ) : (
          <p>
            Published at <code>{address}</code>
          </p>
        )}
      </Tile>
    </li>
  );
}
