// "Added 4 Nov 2026": the day an address was added, as a person reads it. The day is the UTC one and the words are fixed, so the server and
// the browser draw the same text whatever the reader's time zone or language (a mismatch would be a hydration error).
const day = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export const addedOnText = (addedAt: string): string =>
  `Added ${day.format(new Date(addedAt))}`;
