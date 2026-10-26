import { StatusLamp } from "./status-lamp.tsx";

// What a list says when asking for it failed. Without an earlier answer it says what could not be loaded; with one, the page keeps showing
// that and says it could not be refreshed. Every list that loads from the server says it the same way, so it is written once.
export function LoadFailureLamp({
  hasEarlier,
  subject,
}: {
  // Whether an earlier answer is still on the page.
  readonly hasEarlier: boolean;
  // What was being loaded, as a noun phrase that starts a sentence ("Your collections").
  readonly subject: string;
}) {
  return (
    <StatusLamp
      label={
        hasEarlier
          ? "Could not refresh. Showing what was loaded earlier."
          : `${subject} could not be loaded.`
      }
      tone="unavailable"
    />
  );
}
