import type { SubmissionSnapshot } from "@ador/shared/collections";
import type { UuidV7 } from "@ador/shared/identifiers";

// The version of a collection that may be shown or acted on as approved: a submission that is in the
// approved state **and** whose creator is still an approved creator. Either half failing means there
// is no approved version, whatever the submission row says.
export interface ApprovedVersion {
  readonly approvedAt: Date;
  readonly collectionId: UuidV7;
  readonly ownerUserId: UuidV7;
  readonly payloadHash: string;
  readonly sequence: number;
  readonly snapshot: SubmissionSnapshot;
  readonly submissionId: UuidV7;
}

export interface ApprovedVersionReader {
  // The approved version as of now, or null. A read that takes no lock: it can be stale by the time it
  // is used, so it is for display. Anything that acts on approval must hold `lockApprovedVersion`.
  findApprovedVersion(collectionId: UuidV7): Promise<ApprovedVersion | null>;
}
