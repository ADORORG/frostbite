import {
  collectionDraftSchema,
  collectionLimits,
  type CollectionDraft,
} from "@ador/shared/collections";

// What the person has typed, as text: nothing is converted until they save, so a half-typed number is
// never rewritten under them.
export interface DraftFormValues {
  readonly bannerAssetId: string | null;
  readonly coverAssetId: string | null;
  readonly description: string;
  readonly name: string;
  readonly plannedSupply: string;
  readonly provenance: string;
  readonly targetChain: string;
}

// Every key of the form, in one place, so code that visits each field needs no casts.
export const draftFormKeys = [
  "bannerAssetId",
  "coverAssetId",
  "description",
  "name",
  "plannedSupply",
  "provenance",
  "targetChain",
] as const satisfies readonly (keyof DraftFormValues)[];

export const draftFormFields = [
  "description",
  "name",
  "plannedSupply",
  "provenance",
  "targetChain",
] as const;

export type DraftFormField = (typeof draftFormFields)[number];
export type DraftFormErrors = Partial<Record<DraftFormField, string>>;

export type DraftFormResult =
  | { readonly draft: CollectionDraft; readonly ok: true }
  | { readonly errors: DraftFormErrors; readonly ok: false };

// Picks the draft's own fields, so a record that carries more (an id, a revision) can be passed in.
export function formFromDraft(draft: CollectionDraft): DraftFormValues {
  return {
    bannerAssetId: draft.bannerAssetId,
    coverAssetId: draft.coverAssetId,
    description: draft.description,
    name: draft.name,
    plannedSupply: String(draft.plannedSupply),
    provenance: draft.provenance,
    targetChain: draft.targetChain,
  };
}

export function newDraftForm(targetChain: string): DraftFormValues {
  return {
    bannerAssetId: null,
    coverAssetId: null,
    description: "",
    name: "",
    plannedSupply: "",
    provenance: "",
    targetChain,
  };
}

const fieldMessages: Readonly<Record<DraftFormField, string>> = {
  description: `Keep the description to ${collectionLimits.description.toLocaleString("en-US")} characters.`,
  name: `Enter a name of up to ${collectionLimits.name} characters.`,
  plannedSupply: `Enter a whole number from 1 to ${collectionLimits.plannedSupply.toLocaleString("en-US")}.`,
  provenance: `Keep this to ${collectionLimits.provenance.toLocaleString("en-US")} characters.`,
  targetChain: "Choose a chain.",
};

// Validates with the same schema the server uses, and turns each problem into a sentence about the
// field it belongs to. The server stays the authority; this only saves a round trip.
export function parseDraftForm(values: DraftFormValues): DraftFormResult {
  // An empty or blank field becomes 0, which the schema refuses like any other number below 1.
  const candidate = { ...values, plannedSupply: Number(values.plannedSupply) };
  const parsed = collectionDraftSchema.safeParse(candidate);
  if (parsed.success) return { draft: parsed.data, ok: true };
  const errors: DraftFormErrors = {};
  for (const field of draftFormFields)
    if (parsed.error.issues.some(({ path }) => path[0] === field))
      errors[field] = fieldMessages[field];
  return { errors, ok: false };
}
