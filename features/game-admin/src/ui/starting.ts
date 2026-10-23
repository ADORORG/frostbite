import type { GameAdminAction } from "@ador/shared/games";

import { actionLabel } from "../domain/copy.ts";

// An action under way, shown the moment it is asked for so a person is never left looking at nothing: what it is, and why it did not
// become a step to review, if it did not.
export interface Starting {
  readonly failure: string | null;
  readonly label: string;
}

// Whether this action is the one being prepared now, for the button that asked for it to show it (and for no other button to).
export const isStarting = (
  starting: Starting | null,
  action: GameAdminAction,
): boolean =>
  starting !== null &&
  starting.failure === null &&
  starting.label === actionLabel(action);
