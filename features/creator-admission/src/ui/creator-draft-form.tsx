"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import {
  creatorApplicationRoutes,
  type CreatorApplicationResponse,
} from "@frostbite/shared/creator-admission";
import { ArcadePanel, StatusLamp } from "@repo/ui/arcade";

import {
  AdmissionField,
  sendCreatorAdmissionRequest,
} from "./form-helpers.tsx";

type SurfaceStatus = "idle" | "working" | "success" | "error";

// The form for an application that can still be changed. The application itself is held by the page, so
// the status card and the form cannot disagree; after a successful submit the page swaps this form for
// what was sent.
export function CreatorDraftForm({
  application,
  onApplication,
}: {
  readonly application: CreatorApplicationResponse["application"] | null;
  readonly onApplication: (
    application: CreatorApplicationResponse["application"],
  ) => void;
}) {
  const [status, setStatus] = useState<SurfaceStatus>("idle");
  const [message, setMessage] = useState(
    "Draft changes remain private until submission.",
  );
  const [dirty, setDirty] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("working");
    const data = new FormData(event.currentTarget);
    const values = (name: string) =>
      data.getAll(name).map(String).filter(Boolean);
    try {
      const result = await sendCreatorAdmissionRequest(
        creatorApplicationRoutes.saveDraft,
        {
          draft: {
            contentDeclarationAccepted:
              data.get("contentDeclarationAccepted") === "on",
            displayName: String(data.get("displayName") ?? ""),
            expectedLaunchSize: String(data.get("expectedLaunchSize") ?? ""),
            expectedLaunchTiming: String(
              data.get("expectedLaunchTiming") ?? "",
            ),
            jurisdictionAcknowledged:
              data.get("jurisdictionAcknowledged") === "on",
            portfolioLinks: values("portfolioLinks"),
            projectSummary: String(data.get("projectSummary") ?? ""),
            provenanceDeclarationAccepted:
              data.get("provenanceDeclarationAccepted") === "on",
            rightsDeclarationAccepted:
              data.get("rightsDeclarationAccepted") === "on",
          },
        },
      );
      onApplication(result.application);
      setStatus("success");
      setDirty(false);
      setMessage(`Private draft saved. State: ${result.application.state}.`);
    } catch {
      setStatus("error");
      setMessage(
        "Draft save failed. No success has been assumed; retry when the service is available.",
      );
    }
  }
  async function submit() {
    setStatus("working");
    try {
      const result = await sendCreatorAdmissionRequest(
        creatorApplicationRoutes.submit,
        {},
      );
      onApplication(result.application);
      setStatus("success");
      setMessage(
        `Immutable review snapshot submitted. State: ${result.application.state}.`,
      );
    } catch {
      setStatus("error");
      setMessage(
        "Submission failed. Save a complete draft and verify your contact email before retrying.",
      );
    }
  }
  const draft = application?.draft;
  const submittable =
    application?.state === "draft" ||
    application?.state === "changes-requested";
  return (
    <ArcadePanel eyebrow="Private creator evidence" title="Creator application">
      <StatusLamp
        label={message}
        tone={
          status === "success"
            ? "ready"
            : status === "error"
              ? "unavailable"
              : "attention"
        }
      />
      <form
        className="arcade-form"
        onChange={() => {
          setDirty(true);
          setMessage("Save this draft before submitting a snapshot.");
        }}
        onSubmit={save}
      >
        <AdmissionField
          defaultValue={draft?.displayName}
          label="Display name"
          name="displayName"
        />
        <AdmissionField
          defaultValue={draft?.portfolioLinks[0]}
          label="Portfolio URL"
          name="portfolioLinks"
          required={false}
        />
        <label>
          <span>Project summary</span>
          <textarea
            defaultValue={draft?.projectSummary}
            name="projectSummary"
            required
          />
        </label>
        <AdmissionField
          defaultValue={draft?.expectedLaunchSize}
          label="Expected launch size"
          name="expectedLaunchSize"
        />
        <AdmissionField
          defaultValue={draft?.expectedLaunchTiming}
          label="Expected launch timing"
          name="expectedLaunchTiming"
        />
        {[
          [
            "rightsDeclarationAccepted",
            "I hold the required rights and licences.",
            draft?.rightsDeclarationAccepted,
          ],
          [
            "provenanceDeclarationAccepted",
            "I confirm the stated provenance.",
            draft?.provenanceDeclarationAccepted,
          ],
          [
            "contentDeclarationAccepted",
            "I accept the content declaration.",
            draft?.contentDeclarationAccepted,
          ],
          [
            "jurisdictionAcknowledged",
            "I acknowledge applicable jurisdiction requirements.",
            draft?.jurisdictionAcknowledged,
          ],
        ].map(([name, label, checked]) => (
          <label key={String(name)}>
            <input
              defaultChecked={Boolean(checked)}
              name={String(name)}
              type="checkbox"
            />
            <span>{String(label)}</span>
          </label>
        ))}
        <div className="arcade-actions">
          <button
            className="arcade-button arcade-button--cyan"
            disabled={status === "working"}
            type="submit"
          >
            Save private draft
          </button>
          <button
            className="arcade-button arcade-button--yellow"
            disabled={status === "working" || dirty || !submittable}
            onClick={submit}
            type="button"
          >
            Submit snapshot
          </button>
        </div>
      </form>
    </ArcadePanel>
  );
}
