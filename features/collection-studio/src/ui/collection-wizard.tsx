"use client";

import type { ChainOption } from "@ador/shared/chain";
import type { CollectionDetail } from "@ador/shared/collections";
import { collectionStudioPath } from "@ador/shared/collections";
import { creatorApplicationPath } from "@ador/shared/creator-admission";
import type { LibraryResponse } from "@ador/shared/uploads";
import { ArcadeActionButton, ArcadePanel, StatusLamp } from "@repo/ui/arcade";
import { useEffect, useRef, useState } from "react";

import {
  firstOpenStep,
  stepFromHash,
  stepLabels,
  wizardSteps,
  type WizardStep,
} from "../client/progress.ts";
import {
  createBrowserServices,
  type CollectionsClientServices,
} from "../client/services.ts";
import { FailureNotice } from "./components/notice.tsx";
import { ImagesStep } from "./components/images-step.tsx";
import { ItemsStep } from "./components/items-step.tsx";
import { ReviewStep } from "./components/review-step.tsx";
import { StepNav } from "./components/step-nav.tsx";
import { DetailsFields, SupplyFields } from "./components/step-fields.tsx";
import { useDraftEditor } from "./hooks/use-draft-editor.ts";
import { useDraftForm } from "./hooks/use-draft-form.ts";
import { useSubmissions } from "./hooks/use-submissions.ts";
import { useResource, type LoadedResource } from "./hooks/use-resource.ts";

// The wizard for one draft. It loads the draft, lands the creator on the first step that still asks
// for something, and saves as they go. Everything is read from the server, so leaving and coming back
// (on any device) resumes where the draft stands.
export function CollectionWizard({
  collectionId,
  services: provided,
  targetChains,
}: {
  readonly collectionId: string;
  readonly services?: CollectionsClientServices;
  readonly targetChains: readonly ChainOption[];
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const editor = useDraftEditor(services, collectionId);
  const library = useResource(
    (signal) => services.api.listImages({ signal }),
    "images",
  );
  const { state } = editor;
  const detail = state.status === "loading" ? null : state.data;

  if (detail === null)
    return state.status === "error" ? (
      <ArcadePanel
        eyebrow="Collection"
        title="This collection could not be opened"
      >
        <StatusLamp label={state.failure.message} tone="unavailable" />
        <div className="arcade-actions">
          {state.failure.retryable ? (
            <ArcadeActionButton onClick={editor.reload} tone="yellow">
              Retry
            </ArcadeActionButton>
          ) : null}
        </div>
      </ArcadePanel>
    ) : (
      <ArcadePanel eyebrow="Collection" title="Loading your collection">
        <StatusLamp label="Loading your collection…" tone="attention" />
      </ArcadePanel>
    );
  return (
    <WizardBody
      chains={targetChains}
      detail={detail}
      editor={editor}
      library={library}
      services={services}
    />
  );
}

function WizardBody({
  chains,
  detail,
  editor,
  library,
  services,
}: {
  readonly chains: readonly ChainOption[];
  readonly detail: CollectionDetail;
  readonly editor: ReturnType<typeof useDraftEditor>;
  readonly library: LoadedResource<LibraryResponse>;
  readonly services: CollectionsClientServices;
}) {
  const draft = useDraftForm(editor, detail);
  const submissions = useSubmissions(services, detail.collection.id);
  // After an image is uploaded here: fetch the library again and put it in place, so the new image is
  // in the list before it is chosen. If that fails, the usual reload (with its retry) takes over.
  async function refreshLibrary(): Promise<void> {
    try {
      library.replace(
        await services.api.listImages({ signal: new AbortController().signal }),
      );
    } catch {
      library.reload();
    }
  }
  const [chosen, setChosen] = useState<WizardStep | null>(null);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const step =
    chosen ?? stepFromHash(window.location.hash) ?? firstOpenStep(detail);

  // After the creator moves between steps, focus lands on the new step's heading, so keyboard and
  // screen-reader users start at the top of what changed. Nothing is focused on first load.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step]);

  const go = (next: WizardStep) => {
    moved.current = true;
    setSaved(false);
    setChosen(next);
    window.history.replaceState(null, "", `#${next}`);
  };
  const next = wizardSteps[wizardSteps.indexOf(step) + 1];
  const saving = step === "details" || step === "supply" || step === "images";

  async function save(thenGo?: WizardStep) {
    if (!(await draft.save())) return;
    setSaved(true);
    if (thenGo !== undefined) go(thenGo);
  }

  const assets =
    library.state.status === "loading"
      ? []
      : (library.state.data?.assets ?? []);
  return (
    <ArcadePanel eyebrow="Private draft" title={detail.collection.name}>
      <StepNav current={step} detail={detail} onSelect={go} />
      <h3 ref={heading} tabIndex={-1}>
        {stepLabels[step]}
      </h3>
      {[editor, submissions].map((source, index) =>
        source.notice === null ? null : (
          <FailureNotice
            applyHref={creatorApplicationPath}
            failure={source.notice}
            key={index}
            onDismiss={source.dismissNotice}
            onReload={() => {
              source.dismissNotice();
              editor.reload();
              submissions.list.reload();
            }}
          />
        ),
      )}
      {step === "details" ? (
        <DetailsFields
          disabled={editor.busy}
          errors={draft.errors}
          form={draft.form}
          onChange={draft.change}
        />
      ) : null}
      {step === "supply" ? (
        <SupplyFields
          chains={chains}
          disabled={editor.busy}
          errors={draft.errors}
          form={draft.form}
          onChange={draft.change}
        />
      ) : null}
      {step === "images" ? (
        <ImagesStep
          disabled={editor.busy}
          form={draft.form}
          library={library.state}
          onChange={draft.change}
          onRefresh={library.reload}
          onUploaded={refreshLibrary}
        />
      ) : null}
      {step === "items" ? (
        <ItemsStep
          assets={assets}
          createKey={services.createIdempotencyKey}
          detail={detail}
          editor={editor}
          onUploaded={refreshLibrary}
        />
      ) : null}
      {step === "review" ? (
        <ReviewStep
          busy={submissions.busy}
          chains={chains}
          detail={detail}
          listHref={collectionStudioPath}
          onRefresh={submissions.list.reload}
          onSubmit={() => void submissions.submit(detail.collection.revision)}
          submissions={submissions.list.state}
          unsaved={draft.dirty}
        />
      ) : null}
      {draft.dirty && saving ? (
        <StatusLamp
          label="You have changes that are not saved yet."
          tone="attention"
        />
      ) : null}
      {saved && !draft.dirty && saving ? (
        <StatusLamp label="Saved." tone="ready" />
      ) : null}
      <div className="arcade-actions">
        {saving ? (
          <>
            <ArcadeActionButton
              disabled={editor.busy}
              onClick={() => void save()}
              tone="mint"
            >
              Save
            </ArcadeActionButton>
            {next === undefined ? null : (
              <ArcadeActionButton
                disabled={editor.busy}
                onClick={() => void save(next)}
                tone="cyan"
              >
                Save and continue
              </ArcadeActionButton>
            )}
          </>
        ) : next === undefined ? null : (
          <ArcadeActionButton onClick={() => go(next)} tone="cyan">
            Continue
          </ArcadeActionButton>
        )}
      </div>
    </ArcadePanel>
  );
}
