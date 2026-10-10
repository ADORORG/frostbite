import { ArcadeButton } from "@repo/ui/arcade";

import type { NextStep as Step } from "../../client/creator-standing.ts";

// The one thing worth doing next, above everything else on the studio home.
export function NextStep({ step }: { readonly step: Step }) {
  return (
    <section aria-label="Next step" className="arcade-callout">
      <p className="arcade-eyebrow">Next step</p>
      <p className="arcade-callout__text">{step.text}</p>
      <ArcadeButton href={step.href} tone="mint">
        {step.label}
      </ArcadeButton>
    </section>
  );
}
