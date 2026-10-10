import type { CollectionDetail } from "@ador/shared/collections";

export const wizardSteps = [
  "details",
  "supply",
  "images",
  "items",
  "review",
] as const;

export type WizardStep = (typeof wizardSteps)[number];

export const stepLabels: Readonly<Record<WizardStep, string>> = {
  details: "Details",
  images: "Images",
  items: "Items",
  review: "Review",
  supply: "Supply and chain",
};

// Whether a step has what it asks for. These are prompts for the creator, not submission rules: what a
// submission requires is decided when submission exists. The supply step is always filled (a draft
// cannot exist without a supply and a chain), and review is never "done".
export function isStepFilled(
  detail: CollectionDetail,
  step: WizardStep,
): boolean {
  switch (step) {
    case "details":
      return detail.collection.description.trim() !== "";
    case "images":
      return detail.collection.coverAssetId !== null;
    case "items":
      return detail.items.length > 0;
    case "supply":
      return true;
    case "review":
      return false;
  }
}

// Where a returning creator should land: the first step that still asks for something, else review.
export function firstOpenStep(detail: CollectionDetail): WizardStep {
  return (
    wizardSteps.find(
      (step) => step !== "review" && !isStepFilled(detail, step),
    ) ?? "review"
  );
}

// The step named by a URL hash such as `#items`, or null when it names none.
export function stepFromHash(hash: string): WizardStep | null {
  const name = hash.replace(/^#/u, "");
  return wizardSteps.find((step) => step === name) ?? null;
}
