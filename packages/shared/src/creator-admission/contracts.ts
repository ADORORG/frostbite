import { z } from "zod";

import { accountReasonCodeSchema } from "../accounts/contracts.ts";
import { uuidV7Schema } from "../identifiers/uuid-v7.ts";

export const creatorApplicationSchemaVersion = 1;
export const creatorAdmissionPolicyVersion = "creator-admission-beta-v1";

export const creatorApplicationStates = [
  "draft",
  "submitted",
  "under-review",
  "approved",
  "changes-requested",
  "rejected",
  "suspended",
  "revoked",
] as const;

export const creatorApplicationStateSchema = z.enum(creatorApplicationStates);

export const creatorAdmissionActions = [
  "save-draft",
  "submit",
  "start-review",
  "approve",
  "request-changes",
  "reject",
  "resubmit",
  "suspend",
  "reinstate",
  "revoke",
] as const;

export const creatorAdmissionActionSchema = z.enum(creatorAdmissionActions);

// Engineering boundary limits protect storage and rendering; product quotas remain gated.
export const creatorApplicationFieldLimits = Object.freeze({
  displayName: 120,
  evidenceReferences: 20,
  expectedLaunchDescription: 500,
  linkLength: 2_048,
  portfolioLinks: 10,
  privateNotes: 4_000,
  projectSummary: 4_000,
  reviewerFeedback: 2_000,
});

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

const portfolioLinkSchema = z
  .url()
  .max(creatorApplicationFieldLimits.linkLength);

export const creatorApplicationDraftSchema = z
  .object({
    contentDeclarationAccepted: z.boolean(),
    displayName: boundedText(creatorApplicationFieldLimits.displayName),
    expectedLaunchSize: boundedText(
      creatorApplicationFieldLimits.expectedLaunchDescription,
    ),
    expectedLaunchTiming: boundedText(
      creatorApplicationFieldLimits.expectedLaunchDescription,
    ),
    jurisdictionAcknowledged: z.boolean(),
    portfolioLinks: z
      .array(portfolioLinkSchema)
      .max(creatorApplicationFieldLimits.portfolioLinks),
    projectSummary: boundedText(creatorApplicationFieldLimits.projectSummary),
    provenanceDeclarationAccepted: z.boolean(),
    rightsDeclarationAccepted: z.boolean(),
  })
  .strict();

export const creatorApplicationSubmissionSchema =
  creatorApplicationDraftSchema.superRefine((value, context) => {
    const declarations = [
      value.contentDeclarationAccepted,
      value.jurisdictionAcknowledged,
      value.provenanceDeclarationAccepted,
      value.rightsDeclarationAccepted,
    ];
    if (declarations.some((accepted) => !accepted)) {
      context.addIssue({
        code: "custom",
        message: "All declarations must be accepted before submission.",
      });
    }
  });

// What a reviewer can do to an application (the applicant's own actions are not among them).
export const creatorReviewActions = [
  "start-review",
  "approve",
  "request-changes",
  "reject",
  "suspend",
  "reinstate",
  "revoke",
] as const;

export const creatorReviewDecisionSchema = z
  .object({
    action: z.enum(creatorReviewActions),
    applicationId: uuidV7Schema,
    creatorFeedback: z
      .string()
      .trim()
      .max(creatorApplicationFieldLimits.reviewerFeedback),
    evidenceReferences: z
      .array(z.url().max(creatorApplicationFieldLimits.linkLength))
      .max(creatorApplicationFieldLimits.evidenceReferences),
    privateNotes: z
      .string()
      .trim()
      .max(creatorApplicationFieldLimits.privateNotes),
    reasonCode: accountReasonCodeSchema,
  })
  .strict();

export type CreatorAdmissionAction = z.infer<
  typeof creatorAdmissionActionSchema
>;
export type CreatorApplicationDraft = z.infer<
  typeof creatorApplicationDraftSchema
>;
export type CreatorApplicationState = z.infer<
  typeof creatorApplicationStateSchema
>;
export type CreatorReviewDecision = z.infer<typeof creatorReviewDecisionSchema>;
