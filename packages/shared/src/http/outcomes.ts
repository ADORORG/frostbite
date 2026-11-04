import type { HttpErrorCode } from "./index.ts";

// One thing that can go wrong in an area, and what is said about it. `http` is the status class the server answers with, or null for what
// only ever happens in the browser (no connection, a prompt closed). `serverWords` marks the few where the server knows more than the
// catalogue (how long to wait, which sign-in methods are missing), so the page shows the server's sentence when it sent one and the
// catalogue's otherwise.
export interface OutcomeEntry {
  readonly http: HttpErrorCode | null;
  readonly message: string;
  readonly serverWords?: true;
}

// What a catalogue of outcomes does for the area that owns it, the same for every area: say whether a reason a server sent is one of its
// own (a page never trusts a string it was not built with), and give the words for one. The entries themselves stay a plain constant in
// the area, so each name keeps its own type.
export function defineOutcomes<
  Entries extends { readonly [Name in keyof Entries]: OutcomeEntry },
>(entries: Entries) {
  type Name = Extract<keyof Entries, string>;
  const known: ReadonlySet<string> = new Set(Object.keys(entries));
  return {
    isOutcome: (reason: string | null): reason is Name =>
      reason !== null && known.has(reason),
    // The words for an outcome, preferring the server's own where the catalogue says it knows more.
    messageOf(name: Name, serverMessage: string | null = null): string {
      const entry: OutcomeEntry = entries[name];
      return entry.serverWords === true && serverMessage !== null
        ? serverMessage
        : entry.message;
    },
  };
}
