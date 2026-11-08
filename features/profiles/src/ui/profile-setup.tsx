"use client";

import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import type { ShareConfig } from "@frostbite/share";
import { nameShapeProblem } from "@frostbite/shared/profiles";
import { ArcadeActionButton } from "@repo/ui/arcade";
import { useMemo, type ReactNode } from "react";

import { createProfileApi, type ProfileApi } from "../client/profile-api.ts";
import { profileCopy } from "../domain/copy.ts";
import { nameStatusOf, type NameStatusView } from "../domain/name-status.ts";
import { AvatarPicker } from "./avatar-picker.tsx";
import { DeletePanel } from "./delete-panel.tsx";
import { NameField } from "./name-field.tsx";
import { PlayerCard } from "./player-card.tsx";
import { ProfilesFrame } from "./profiles-frame.tsx";
import { SetupOutcome } from "./setup-outcome.tsx";
import { SetupFailed, SetupSkeleton } from "./setup-states.tsx";
import { useNameCheck } from "./use-name-check.ts";
import { useProfileSetup } from "./use-profile-setup.ts";
import { VisibilitySwitch } from "./visibility-switch.tsx";

function Stage({
  children,
  lead,
  number,
  title,
}: {
  readonly children: ReactNode;
  readonly lead?: string;
  readonly number: number;
  readonly title: string;
}) {
  return (
    <section className="profile-stage">
      <div className="profile-stage__head">
        <span aria-hidden="true" className="profile-stage__number">
          {number}
        </span>
        <h2 className="profile-stage__title">{title}</h2>
      </div>
      {lead === undefined ? null : (
        <p className="profile-stage__lead">{lead}</p>
      )}
      {children}
    </section>
  );
}

// Where a player makes their profile: a live card, then three short stages (fighter, name, whether the page is shown) and one Save. Nothing
// is saved until Save is pressed, and Save is held back until the name is one the platform would accept.
export function ProfileSetup({
  api: given,
  navigation,
  share,
}: {
  readonly api?: ProfileApi | undefined;
  readonly navigation: readonly NavigationItem[];
  readonly share?: ShareConfig | undefined;
}) {
  const api = useMemo(() => given ?? createProfileApi(), [given]);
  const { busy, draft, outcome, phase, reload, remove, save, setDraft } =
    useProfileSetup(api);
  const saved = phase.kind === "ready" ? phase.saved : null;
  const bounds =
    phase.kind === "ready"
      ? { maxLength: phase.policy.maxLength, minLength: phase.policy.minLength }
      : { maxLength: 20, minLength: 3 };
  const ownName =
    saved !== null && saved.name.toLowerCase() === draft.name.toLowerCase();
  const askNothing =
    phase.kind !== "ready" ||
    draft.name === "" ||
    ownName ||
    nameShapeProblem(draft.name, bounds) !== null;
  const check = useNameCheck(api, draft.name, askNothing);
  const status: NameStatusView = ownName
    ? {
        error: null,
        note: { text: profileCopy.nameStatus.yours, tone: "good" },
      }
    : nameStatusOf(draft.name, bounds, check);
  const unchanged =
    saved !== null &&
    saved.name === draft.name &&
    saved.avatar === draft.avatar &&
    saved.visible === draft.visible;
  const nameFine =
    draft.name !== "" &&
    nameShapeProblem(draft.name, bounds) === null &&
    status.error === null;
  const canSave =
    phase.kind === "ready" && nameFine && !unchanged && busy === null;
  const { hero, preview, save: saveCopy } = profileCopy.setup;
  return (
    <ProfilesFrame navigation={navigation}>
      <header className="profile-hero">
        <p className="arcade-eyebrow">{hero.eyebrow}</p>
        <h1>{hero.title}</h1>
        <p className="profile-hero__lead">{hero.lead}</p>
      </header>
      {phase.kind === "loading" ? <SetupSkeleton /> : null}
      {phase.kind === "failed" ? <SetupFailed onRetry={reload} /> : null}
      {phase.kind === "ready" ? (
        <form
          className="profile-setup"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) void save();
          }}
        >
          <aside className="profile-setup__preview">
            <p className="profile-setup__preview-label">{preview.label}</p>
            <PlayerCard
              avatar={draft.avatar}
              joined={
                saved === null
                  ? null
                  : profileCopy.card.joined(saved.memberSince)
              }
              name={draft.name}
            />
          </aside>
          <div className="profile-setup__stages">
            <Stage
              lead={profileCopy.setup.avatar.lead}
              number={1}
              title={profileCopy.setup.avatar.title}
            >
              <AvatarPicker
                onChange={(avatar) => setDraft({ avatar })}
                value={draft.avatar}
              />
            </Stage>
            <Stage
              lead={profileCopy.setup.name.lead}
              number={2}
              title={profileCopy.setup.name.title}
            >
              <NameField
                bounds={bounds}
                disabled={busy !== null}
                onChange={(name) => setDraft({ name })}
                status={status}
                value={draft.name}
              />
            </Stage>
            <Stage number={3} title={profileCopy.setup.visibility.title}>
              <VisibilitySwitch
                onChange={(visible) => setDraft({ visible })}
                value={draft.visible}
              />
            </Stage>
            <SetupOutcome
              bounds={bounds}
              outcome={outcome}
              saved={saved}
              share={share}
            />
            <div className="profile-actions">
              <ArcadeActionButton
                busy={busy === "save"}
                disabled={!canSave}
                tone="yellow"
                type="submit"
              >
                {busy === "save" ? saveCopy.busy : saveCopy.idle}
              </ArcadeActionButton>
              {unchanged ? (
                <p className="profile-actions__note">{saveCopy.unchanged}</p>
              ) : null}
            </div>
            {saved === null ? null : (
              <DeletePanel
                busy={busy === "remove"}
                onConfirm={() => void remove()}
              />
            )}
          </div>
        </form>
      ) : null}
    </ProfilesFrame>
  );
}
