import type { ChainOption } from "@frostbite/shared/chain";
import {
  collectionStudioPath,
  collectionWizardHref,
} from "@frostbite/shared/collections";
import { ArcadeActionButton, ArcadeButton, ArcadePanel } from "@repo/ui/arcade";
import { useRef, useState } from "react";

import { describeFailure, type Failure } from "../../client/error-copy.ts";
import {
  newDraftForm,
  parseDraftForm,
  type DraftFormErrors,
  type DraftFormValues,
} from "../../client/draft-form.ts";
import type { CollectionsClientServices } from "../../client/services.ts";
import { FailureNotice } from "./notice.tsx";
import { DetailsFields, SupplyFields } from "./step-fields.tsx";

// Starts a draft from the three things it cannot exist without: a name, a supply, and a chain.
// Everything else is filled in the wizard. The idempotency key is held for the page's life, so a
// retry after a lost response opens the same draft instead of making a second one.
export function NewCollection({
  applyHref,
  chains,
  services,
}: {
  readonly applyHref: string;
  readonly chains: readonly ChainOption[];
  readonly services: CollectionsClientServices;
}) {
  const [form, setForm] = useState<DraftFormValues>(() =>
    newDraftForm(chains[0]?.chainId ?? ""),
  );
  const [errors, setErrors] = useState<DraftFormErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(services.createIdempotencyKey());

  async function create() {
    const parsed = parseDraftForm(form);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      const created = await services.api.create(parsed.draft, {
        idempotencyKey: key.current,
      });
      services.navigate(collectionWizardHref(created.collection.id));
    } catch (error) {
      setFailure(describeFailure(error));
      setBusy(false);
    }
  }

  const change = (changes: Partial<DraftFormValues>) =>
    setForm((current) => ({ ...current, ...changes }));
  return (
    <ArcadePanel eyebrow="Step 1" title="The basics">
      <DetailsFields
        disabled={busy}
        errors={{ name: errors.name }}
        form={form}
        onChange={change}
        only="name"
      />
      <SupplyFields
        chains={chains}
        disabled={busy}
        errors={errors}
        form={form}
        onChange={change}
      />
      {failure === null ? null : (
        <FailureNotice
          applyHref={applyHref}
          failure={failure}
          onDismiss={() => setFailure(null)}
          onReload={() => setFailure(null)}
        />
      )}
      <div className="arcade-actions">
        <ArcadeActionButton
          disabled={busy}
          onClick={() => void create()}
          tone="mint"
        >
          Create collection
        </ArcadeActionButton>
        <ArcadeButton href={collectionStudioPath} tone="pink">
          Cancel
        </ArcadeButton>
      </div>
    </ArcadePanel>
  );
}
