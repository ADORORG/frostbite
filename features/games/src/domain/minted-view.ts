// While the list is being asked for, the wall holds this many empty places, so it is already the shape of a collection when the
// answer lands. It is a guess at a typical first screen, not a count of anything.
export const mintedPlaceholderCount = 3;

// "17 Oct 2026" from an ISO timestamp.
export const mintedDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });
