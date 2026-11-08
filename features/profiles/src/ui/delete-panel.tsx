"use client";

import { ArcadeActionButton } from "@repo/ui/arcade";
import { useState } from "react";

import { profileCopy } from "../domain/copy.ts";

// Taking the profile down, in two steps that stay on the page: the button opens a plain question, and only the second press deletes.
export function DeletePanel({
  busy,
  onConfirm,
}: {
  readonly busy: boolean;
  readonly onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const { delete: copy } = profileCopy.setup;
  return (
    <section className="profile-danger">
      <h2 className="profile-danger__title">{copy.title}</h2>
      <p className="profile-danger__lead">{copy.lead}</p>
      <div className="profile-danger__actions">
        {asking ? (
          <>
            <ArcadeActionButton busy={busy} onClick={onConfirm} tone="red">
              {copy.confirm}
            </ArcadeActionButton>
            <ArcadeActionButton
              disabled={busy}
              onClick={() => setAsking(false)}
              tone="cyan"
            >
              {copy.cancel}
            </ArcadeActionButton>
          </>
        ) : (
          <ArcadeActionButton
            onClick={() => setAsking(true)}
            size="small"
            tone="red"
          >
            {copy.open}
          </ArcadeActionButton>
        )}
      </div>
    </section>
  );
}
