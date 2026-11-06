import { useEffect, useState } from "react";
import type { CollectionDetail } from "@frostbite/shared/collections";

import {
  draftFormKeys,
  formFromDraft,
  parseDraftForm,
  type DraftFormErrors,
  type DraftFormValues,
} from "../../client/draft-form.ts";
import type { DraftEditor } from "./use-draft-editor.ts";

export interface DraftForm {
  readonly change: (changes: Partial<DraftFormValues>) => void;
  // True while what is shown differs from what the server holds.
  readonly dirty: boolean;
  readonly errors: DraftFormErrors;
  readonly form: DraftFormValues;
  // Validates and saves; resolves true once the server has the draft.
  readonly save: () => Promise<boolean>;
}

// The editable copy of the draft's own fields. Only the fields the person changed are held; every
// other field shows the saved draft, so the form follows the server (after an item change or a reload
// of a draft that changed elsewhere) without ever overwriting what was typed, and a later save never
// writes back a stale value the person did not touch. Leaving the page with unsaved edits asks first.
export function useDraftForm(
  editor: DraftEditor,
  detail: CollectionDetail,
): DraftForm {
  const baseline = formFromDraft(detail.collection);
  const [edits, setEdits] = useState<Partial<DraftFormValues>>({});
  const [errors, setErrors] = useState<DraftFormErrors>({});
  const form: DraftFormValues = { ...baseline, ...edits };
  const dirty = draftFormKeys.some(
    (key) => edits[key] !== undefined && edits[key] !== baseline[key],
  );

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return {
    change: (changes) => setEdits({ ...edits, ...changes }),
    dirty,
    errors,
    form,
    save: async () => {
      const parsed = parseDraftForm(form);
      if (!parsed.ok) {
        setErrors(parsed.errors);
        return false;
      }
      setErrors({});
      const saved = await editor.save(parsed.draft, detail.collection.revision);
      if (saved) setEdits({});
      return saved;
    },
  };
}
