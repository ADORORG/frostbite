import { z } from "zod";

import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import {
  creatorAdmissionActions,
  creatorApplicationDraftSchema,
  type CreatorAdmissionAction,
  type CreatorReviewAction,
  creatorApplicationStateSchema,
  type CreatorApplicationState,
} from "./contracts.ts";

const timestamp = z.iso.datetime({ offset: true });

// Staff work through applications in groups, the same three the collection review queue uses. "all" is every
// application that has been submitted at least once (a draft that was never sent is not for review).
export const creatorReviewGroups = [
  "all",
  "needs-review",
  "active",
  "finished",
] as const;
export type CreatorReviewGroup = (typeof creatorReviewGroups)[number];

export const creatorReviewGroupLabels: Readonly<
  Record<CreatorReviewGroup, string>
> = {
  active: "Approved or paused",
  all: "All",
  finished: "Finished",
  "needs-review": "Needs review",
};

export const creatorReviewGroupStates: Readonly<
  Record<Exclude<CreatorReviewGroup, "all">, readonly CreatorApplicationState[]>
> = {
  active: ["approved", "suspended"],
  finished: ["changes-requested", "rejected", "revoked"],
  "needs-review": ["submitted", "under-review"],
};

// The states a group stands for; every state when the group is "all".
export function statesInGroup(
  group: CreatorReviewGroup,
): readonly CreatorApplicationState[] {
  return group === "all"
    ? Object.values(creatorReviewGroupStates).flat()
    : creatorReviewGroupStates[group];
}

// The words on each thing a reviewer can do, and the reason code a decision starts with (editable).
export const creatorReviewActionLabels: Readonly<
  Record<CreatorReviewAction, string>
> = {
  approve: "Approve",
  reinstate: "Reinstate",
  reject: "Reject",
  "request-changes": "Request changes",
  revoke: "Revoke",
  "start-review": "Start review",
  suspend: "Suspend",
};

export const creatorReviewReasonCodes: Readonly<
  Record<CreatorReviewAction, string>
> = {
  approve: "creator-approved",
  reinstate: "creator-reinstated",
  reject: "creator-not-approved",
  "request-changes": "changes-requested",
  revoke: "creator-revoked",
  "start-review": "review-started",
  suspend: "creator-suspended",
};

// What happened at each step of an application's history, applicant and reviewer alike, past tense.
export const creatorAdmissionEventLabels: Readonly<
  Record<CreatorAdmissionAction, string>
> = {
  approve: "Approved",
  reinstate: "Reinstated",
  reject: "Not approved",
  "request-changes": "Asked for changes",
  resubmit: "Sent it again",
  revoke: "Revoked",
  "save-draft": "Saved a draft",
  "start-review": "Started review",
  submit: "Sent the application",
  suspend: "Suspended",
};

// The words staff use for an application's state, the same ones the collection review uses for a submission.
export const creatorApplicationStateLabels: Readonly<
  Record<CreatorApplicationState, string>
> = {
  approved: "Approved",
  "changes-requested": "Changes requested",
  draft: "Draft",
  rejected: "Not approved",
  revoked: "Revoked",
  submitted: "Submitted",
  suspended: "Suspended",
  "under-review": "In review",
};

// "oldest" is the longest-waiting first, the order staff should usually work in.
export const creatorReviewSorts = ["oldest", "newest", "name"] as const;
export type CreatorReviewSort = (typeof creatorReviewSorts)[number];

export const creatorReviewSortLabels: Readonly<
  Record<CreatorReviewSort, string>
> = {
  name: "Name, A to Z",
  newest: "Newest first",
  oldest: "Oldest first",
};

export const creatorReviewQueueLimits = Object.freeze({ pageSize: 25 });

// A page is continued from the last row seen: its sort key (a time, or a lower-cased name) and its id, so
// the next page is stable while applications arrive. Opaque to callers, and refused when not produced here.
export interface CreatorReviewPosition {
  readonly id: string;
  readonly key: string;
}

const keyLimit = 200;
// Text the database cannot store (it refuses NUL) is not a position this list could have produced.
const cursorKeySchema = z
  .string()
  .min(1)
  .max(keyLimit)
  .refine((key) => !key.includes("\u0000"));

// The cursor's text is UTF-8 (a name can be in any script), turned to bytes before it is made URL-safe.
export function encodeCreatorReviewCursor(
  position: CreatorReviewPosition,
): string {
  const bytes = new TextEncoder().encode(
    JSON.stringify([position.key, position.id]),
  );
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function decodeCreatorReviewCursor(
  cursor: string,
): CreatorReviewPosition | null {
  const padded = cursor.replaceAll("-", "+").replaceAll("_", "/");
  try {
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const text = new TextDecoder().decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
    // `unknown` is what parsing untrusted text yields; it is accepted only through the schema below.
    const parsed: unknown = JSON.parse(text);
    const checked = z
      .tuple([cursorKeySchema, uuidV7TextSchema])
      .safeParse(parsed);
    return checked.success
      ? { id: checked.data[1], key: checked.data[0] }
      : null;
  } catch {
    return null;
  }
}

export const creatorReviewQueueInputSchema = z
  .object({
    cursor: z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,400}$/u)
      .nullable()
      .default(null),
    group: z.enum(creatorReviewGroups),
    sort: z.enum(creatorReviewSorts),
  })
  .strict();

// What staff see in the list: enough to choose what to open, never private notes or contact details.
export const creatorReviewQueueItemSchema = z
  .object({
    applicationId: uuidV7TextSchema,
    displayName: z.string(),
    state: creatorApplicationStateSchema,
    // Which of the applicant's submissions this is (they may send it again after changes).
    submissionNumber: z.number().int().positive(),
    submittedAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

const countSchema = z.number().int().nonnegative();

export const creatorReviewQueueResponseSchema = z
  .object({
    // Every group's size, whatever group is shown, so the filters can say what is behind them.
    counts: z
      .object({
        active: countSchema,
        all: countSchema,
        finished: countSchema,
        "needs-review": countSchema,
      })
      .strict(),
    items: z.array(creatorReviewQueueItemSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const creatorReviewReadInputSchema = z
  .object({ applicationId: uuidV7TextSchema })
  .strict();

// One step in an application's history as staff see it, including what the applicant never sees.
export const creatorReviewEventSchema = z
  .object({
    action: z.enum(creatorAdmissionActions),
    actorName: z.string(),
    createdAt: timestamp,
    creatorFeedback: z.string(),
    nextState: creatorApplicationStateSchema,
    previousState: creatorApplicationStateSchema,
    privateNotes: z.string(),
    reasonCode: z.string(),
  })
  .strict();

// The application as it was last sent (the frozen version a decision is about), and its history.
export const creatorReviewDetailSchema = z
  .object({
    applicationId: uuidV7TextSchema,
    events: z.array(creatorReviewEventSchema),
    snapshot: creatorApplicationDraftSchema,
    state: creatorApplicationStateSchema,
    submissionNumber: z.number().int().positive(),
    submittedAt: timestamp,
  })
  .strict();

export const creatorReviewReadResponseSchema = z
  .object({ application: creatorReviewDetailSchema })
  .strict();

export type CreatorReviewDetail = z.infer<typeof creatorReviewDetailSchema>;
export type CreatorReviewQueueInput = z.infer<
  typeof creatorReviewQueueInputSchema
>;
export type CreatorReviewQueueItem = z.infer<
  typeof creatorReviewQueueItemSchema
>;
export type CreatorReviewQueueResponse = z.infer<
  typeof creatorReviewQueueResponseSchema
>;
export type CreatorReviewReadResponse = z.infer<
  typeof creatorReviewReadResponseSchema
>;
