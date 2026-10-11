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
      <ol className="wizard-steps">
        {wizardSteps.map((step, index) => {
          const done = isStepFilled(detail, step) && step !== "supply";
          return (
            <li key={step}>
              <button
                aria-current={step === current ? "step" : undefined}
                className="wizard-step"
                data-state={
                  step === current ? "current" : done ? "done" : "todo"
                }
                onClick={() => onSelect(step)}
                type="button"
              >
                {`${index + 1}. ${stepLabels[step]}`}
              </button>
              {done ? <ArcadeBadge tone="mint">Done</ArcadeBadge> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
