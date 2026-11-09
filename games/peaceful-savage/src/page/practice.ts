import { handKeys } from "../rules/constants.ts";
import { breathSkill, huddleSkill, mastered } from "../rules/growth.ts";
import type { PlayState } from "../rules/types.ts";

// The skill most worth practising now, for the one Practise button a touch screen has: the huddle once the jackets are woven and the
// family is together (the hill will not call without it), otherwise the hand-key practised least, and the breath once every key is
// mastered.
export function suggestedSkill(state: PlayState): number {
  if (state.jackets && state.party.length > 0 && !mastered(state, huddleSkill))
    return huddleSkill;
  let best = -1;
  let least = Number.POSITIVE_INFINITY;
  handKeys.forEach((_, skill) => {
    const points = state.mastery[skill] ?? 0;
    if (!mastered(state, skill) && points < least) {
      best = skill;
      least = points;
    }
  });
  if (best >= 0) return best;
  return mastered(state, breathSkill) && state.party.length > 0
    ? huddleSkill
    : breathSkill;
}
