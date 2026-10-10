import type { CollectionDetail } from "@ador/shared/collections";
import { ArcadeBadge } from "@repo/ui/arcade";

import {
  isStepFilled,
  stepLabels,
  wizardSteps,
  type WizardStep,
} from "../../client/progress.ts";

// The steps as a list of buttons, so every one is reachable by keyboard and in any order. The current
// step is announced, and a step that already has what it asks for says so in words.
export function StepNav({
  current,
  detail,
  onSelect,
}: {
  readonly current: WizardStep;
  readonly detail: CollectionDetail;
  readonly onSelect: (step: WizardStep) => void;
}) {
  return (
    <nav aria-label="Collection steps">
      <ol className="arcade-actions arcade-steps">
        {wizardSteps.map((step, index) => (
          <li key={step}>
            <button
              aria-current={step === current ? "step" : undefined}
              className={`arcade-button arcade-button--${step === current ? "cyan" : "pink"}`}
              onClick={() => onSelect(step)}
              type="button"
            >
              {`${index + 1}. ${stepLabels[step]}`}
            </button>
            {isStepFilled(detail, step) && step !== "supply" ? (
              <ArcadeBadge tone="mint">Done</ArcadeBadge>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
