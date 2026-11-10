// What the page says about defining many milestones from a folder of drawings. The wording of a step itself (its state, its refusal)
// comes from `copy.ts`; this is only what the batch adds.
export const batchCopy = {
  title: "Define many milestones",
  description:
    "Choose a folder of drawings named for the milestones (first-win.svg draws first-win). Every drawing is checked now; then each milestone is defined in turn, and you review and sign each step.",
  dropLabel: "Choose drawings",
  dropHint: "SVG files, one per milestone, named for its id",
  ready: (count: number) =>
    `${String(count)} ${count === 1 ? "drawing" : "drawings"} ready`,
  unmatched: (names: readonly string[]) =>
    `No milestone matches: ${names.join(", ")}.`,
  start: (count: number) =>
    `Define ${String(count)} ${count === 1 ? "milestone" : "milestones"}`,
  pause: "Pause after this step",
  resume: "Continue",
  stoppedAt: (title: string) =>
    `Stopped at ${title}. Fix what its step shows, then continue.`,
  running: "Defining in order. Review and sign each step as it appears.",
  done: "Every drawing in the batch is defined.",
  rowState: {
    defined: "Defined",
    missing: "No drawing chosen",
    ready: "Ready",
    refused: "Refused",
  },
} as const;
