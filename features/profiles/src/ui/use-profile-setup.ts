import {
  profileAvatarIds,
  type GetMyProfileResponse,
  type ProfileAvatarId,
  type ProfileView,
  type SaveProfileResponse,
} from "@frostbite/shared/profiles";
import { useCallback, useEffect, useState } from "react";

import type { ProfileApi } from "../client/profile-api.ts";

export interface Draft {
  readonly avatar: ProfileAvatarId;
  readonly name: string;
  readonly visible: boolean;
}

export type SetupPhase =
  | { readonly kind: "failed" }
  | { readonly kind: "loading" }
  | {
      readonly kind: "ready";
      readonly policy: GetMyProfileResponse["policy"];
      readonly saved: ProfileView | null;
    };

// What the last save or delete did, for the page to say. A refusal carries the server's words in code (`refusal`, `reason`, `until`), which the
// page turns into sentences from its catalogue.
export type Outcome =
  | { readonly kind: "deleted" }
  | { readonly kind: "failed"; readonly what: "remove" | "save" }
  | {
      readonly kind: "refused";
      readonly refusal: Extract<SaveProfileResponse, { status: "refused" }>;
    }
  | { readonly kind: "saved" };

const fresh: Draft = { avatar: profileAvatarIds[0], name: "", visible: true };
const draftOf = (saved: ProfileView | null): Draft =>
  saved === null
    ? fresh
    : { avatar: saved.avatar, name: saved.name, visible: saved.visible };

// The setup page's state: loading the player's profile, the draft they are editing, saving it and taking it down. Every request goes
// through the api it is given.
export function useProfileSetup(api: ProfileApi) {
  const [phase, setPhase] = useState<SetupPhase>({ kind: "loading" });
  const [draft, setDraft] = useState<Draft>(fresh);
  const [busy, setBusy] = useState<"remove" | "save" | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    api
      .getMine()
      .then(({ policy, profile }) => {
        if (!current) return;
        setDraft(draftOf(profile));
        setPhase({ kind: "ready", policy, saved: profile });
      })
      .catch(() => {
        if (current) setPhase({ kind: "failed" });
      });
    return () => {
      current = false;
    };
  }, [api, attempt]);

  const reload = useCallback(() => {
    setPhase({ kind: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  const save = useCallback(async () => {
    if (phase.kind !== "ready") return;
    setBusy("save");
    setOutcome(null);
    try {
      const answer = await api.save(draft);
      if (answer.status === "saved") {
        setPhase({ ...phase, saved: answer.profile });
        setDraft(draftOf(answer.profile));
        setOutcome({ kind: "saved" });
      } else setOutcome({ kind: "refused", refusal: answer });
    } catch {
      setOutcome({ kind: "failed", what: "save" });
    } finally {
      setBusy(null);
    }
  }, [api, draft, phase]);

  const remove = useCallback(async () => {
    if (phase.kind !== "ready") return;
    setBusy("remove");
    setOutcome(null);
    try {
      await api.remove();
      setPhase({ ...phase, saved: null });
      setDraft(fresh);
      setOutcome({ kind: "deleted" });
    } catch {
      setOutcome({ kind: "failed", what: "remove" });
    } finally {
      setBusy(null);
    }
  }, [api, phase]);

  return {
    busy,
    draft,
    outcome,
    phase,
    reload,
    remove,
    save,
    setDraft: (change: Partial<Draft>) => {
      setOutcome(null);
      setDraft((current) => ({ ...current, ...change }));
    },
  };
}
