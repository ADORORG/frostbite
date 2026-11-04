// The words for what can go wrong around a transaction a person signs, said once for every feature that has one (a player's claim, a
// staff step). The features differ only in what they call the thing, so each names it and gets the same sentences; the two sentences that
// do not depend on the name are written here and nowhere else. A step that finds the network gone or a signature that does not match
// what was shown says the same to a player as it does to staff.
export const chainUnreachableWords =
  "The network could not be reached. Try again.";
export const signatureMismatchWords =
  "What was signed is not what was shown. Nothing was sent.";

// Why the platform turns down a signed transaction it was handed: the same five for a claim and a step, so the claim and admin schemas
// take this list as their own rather than writing it again.
export const submitRefusalReasons = [
  "chain-unavailable",
  "expired",
  "invalid-signature",
  "not-awaiting-signature",
  "not-found",
] as const;
export type SubmitRefusalReason = (typeof submitRefusalReasons)[number];

// What the thing a person signs is called where it is talked about.
export type ChainStepSubject = "claim" | "step";

export function submitRefusalWords(
  subject: ChainStepSubject,
): Readonly<Record<SubmitRefusalReason, string>> {
  return {
    "chain-unavailable": chainUnreachableWords,
    expired: `It was not signed in time. Start the ${subject} again.`,
    "invalid-signature": signatureMismatchWords,
    "not-awaiting-signature": `This ${subject} can no longer be signed.`,
    "not-found": `This ${subject} could not be found.`,
  };
}
