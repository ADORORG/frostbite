import { z } from "zod";

import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";
import {
  submissionActionSchema,
  submissionStateSchema,
} from "./review-state.ts";

const timestamp = z.iso.datetime({ offset: true });

// The activity log is read newest first, a page at a time. The cursor is the position of the last event
// seen (its time and id), so a page is stable while new events arrive. It is opaque to callers.
const cursorPattern = /^[A-Za-z0-9_-]{20,200}$/u;
export const activityCursorSchema = z.string().regex(cursorPattern);

export interface ActivityPosition {
  readonly createdAt: string;
  readonly id: string;
}

const separator = "|";

export function encodeActivityCursor(position: ActivityPosition): string {
  return btoa(`${position.createdAt}${separator}${position.id}`)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

// The position a cursor names, or null when it is not one this module produced.
export function decodeActivityCursor(cursor: string): ActivityPosition | null {
  const padded = cursor.replaceAll("-", "+").replaceAll("_", "/");
  try {
    const [createdAt, id, ...rest] = atob(
      padded + "=".repeat((4 - (padded.length % 4)) % 4),
    ).split(separator);
    return rest.length === 0 &&
      timestamp.safeParse(createdAt).success &&
      uuidV7TextSchema.safeParse(id).success &&
      createdAt !== undefined &&
      id !== undefined
      ? { createdAt, id }
      : null;
  } catch {
    return null;
  }
}

// One event of the activity log, as staff see it in the list: who did what to which submission, when.
// Private notes and feedback stay on the submission's own page.
export const reviewActivityItemSchema = z
  .object({
    action: submissionActionSchema,
    actorName: z.string(),
    actorUserId: uuidV7TextSchema,
    collectionId: uuidV7TextSchema,
    collectionName: z.string(),
    createdAt: timestamp,
    eventId: uuidV7TextSchema,
    nextState: submissionStateSchema,
    previousState: submissionStateSchema.nullable(),
    reasonCode: z.string(),
    sequence: z.number().int().positive(),
    submissionId: uuidV7TextSchema,
  })
  .strict();

export const reviewActivityInputSchema = z
  .object({ cursor: activityCursorSchema.nullable().default(null) })
  .strict();

export const reviewActivityResponseSchema = z
  .object({
    items: z.array(reviewActivityItemSchema),
    nextCursor: activityCursorSchema.nullable(),
  })
  .strict();

export type ReviewActivityInput = z.infer<typeof reviewActivityInputSchema>;
export type ReviewActivityItem = z.infer<typeof reviewActivityItemSchema>;
export type ReviewActivityResponse = z.infer<
  typeof reviewActivityResponseSchema
>;
