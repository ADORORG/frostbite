export const creatorE2EFixtures = {
  applicant: {
    sessionId: "01994b10-0000-7000-8000-000000000002",
    sessionToken: "e2e-applicant-session-token",
    userId: "01994b10-0000-7000-8000-000000000001",
  },
  reviewer: {
    roleId: "01994b10-0000-7000-8000-000000000005",
    sessionId: "01994b10-0000-7000-8000-000000000004",
    sessionToken: "e2e-reviewer-session-token",
    userId: "01994b10-0000-7000-8000-000000000003",
  },
  staff: {
    roleId: "01994b10-0000-7000-8000-00000000000d",
    sessionId: "01994b10-0000-7000-8000-00000000000c",
    sessionToken: "e2e-staff-session-token",
    userId: "01994b10-0000-7000-8000-00000000000b",
  },
  passkeyUser: {
    sessionId: "01994b10-0000-7000-8000-000000000008",
    sessionToken: "e2e-passkey-session-token",
    userId: "01994b10-0000-7000-8000-000000000007",
  },
  // Uploaders with their own sessions, so parallel specs never share (or revoke) a session and a
  // spec can prove one user never sees another's images.
  uploader: {
    sessionId: "01994b10-0000-7000-8000-00000000000f",
    sessionToken: "e2e-uploader-session-token",
    userId: "01994b10-0000-7000-8000-00000000000e",
  },
  otherUploader: {
    sessionId: "01994b10-0000-7000-8000-000000000011",
    sessionToken: "e2e-other-uploader-session-token",
    userId: "01994b10-0000-7000-8000-000000000010",
  },
  rejectedUploader: {
    sessionId: "01994b10-0000-7000-8000-000000000013",
    sessionToken: "e2e-rejected-uploader-session-token",
    userId: "01994b10-0000-7000-8000-000000000012",
  },
  undecodableUploader: {
    sessionId: "01994b10-0000-7000-8000-000000000015",
    sessionToken: "e2e-undecodable-uploader-session-token",
    userId: "01994b10-0000-7000-8000-000000000014",
  },
  localCheckUploader: {
    sessionId: "01994b10-0000-7000-8000-000000000017",
    sessionToken: "e2e-local-check-uploader-session-token",
    userId: "01994b10-0000-7000-8000-000000000016",
  },
  retryUploader: {
    sessionId: "01994b10-0000-7000-8000-000000000019",
    sessionToken: "e2e-retry-uploader-session-token",
    userId: "01994b10-0000-7000-8000-000000000018",
  },
  // Acceptance flows (W3-08), each with its own session so parallel specs never share one.
  acceptanceApiUploader: {
    sessionId: "01994b10-0000-7000-8000-00000000001b",
    sessionToken: "e2e-acceptance-api-uploader-session-token",
    userId: "01994b10-0000-7000-8000-00000000001a",
  },
  acceptanceApiOther: {
    sessionId: "01994b10-0000-7000-8000-00000000001d",
    sessionToken: "e2e-acceptance-api-other-session-token",
    userId: "01994b10-0000-7000-8000-00000000001c",
  },
  acceptanceFormatUploader: {
    sessionId: "01994b10-0000-7000-8000-00000000001f",
    sessionToken: "e2e-acceptance-format-uploader-session-token",
    userId: "01994b10-0000-7000-8000-00000000001e",
  },
  acceptanceHostileUploader: {
    sessionId: "01994b10-0000-7000-8000-000000000021",
    sessionToken: "e2e-acceptance-hostile-uploader-session-token",
    userId: "01994b10-0000-7000-8000-000000000020",
  },
  visualUser: {
    sessionId: "01994b10-0000-7000-8000-00000000000a",
    sessionToken: "e2e-visual-session-token",
    userId: "01994b10-0000-7000-8000-000000000009",
  },
  // Collection drafts (W4-01): two approved creators, so a spec can prove one never reaches the other's
  // drafts or images, and a user who never applied, who must be refused.
  collectionCreator: {
    sessionId: "01994b10-0000-7000-8000-000000000023",
    sessionToken: "e2e-collection-creator-session-token",
    userId: "01994b10-0000-7000-8000-000000000022",
  },
  collectionOtherCreator: {
    sessionId: "01994b10-0000-7000-8000-000000000025",
    sessionToken: "e2e-collection-other-creator-session-token",
    userId: "01994b10-0000-7000-8000-000000000024",
  },
  collectionAccessOwner: {
    sessionId: "01994b10-0000-7000-8000-000000000029",
    sessionToken: "e2e-collection-access-owner-session-token",
    userId: "01994b10-0000-7000-8000-000000000028",
  },
  // The collection wizard (W4-02): one creator who builds a draft in the browser, one who only reads
  // an empty list, and one whose draft is the subject of the visual and accessibility checks.
  collectionWizardCreator: {
    sessionId: "01994b10-0000-7000-8000-00000000002b",
    sessionToken: "e2e-collection-wizard-creator-session-token",
    userId: "01994b10-0000-7000-8000-00000000002a",
  },
  collectionQualityList: {
    sessionId: "01994b10-0000-7000-8000-00000000002d",
    sessionToken: "e2e-collection-quality-list-session-token",
    userId: "01994b10-0000-7000-8000-00000000002c",
  },
  collectionQualityWizard: {
    sessionId: "01994b10-0000-7000-8000-00000000002f",
    sessionToken: "e2e-collection-quality-wizard-session-token",
    userId: "01994b10-0000-7000-8000-00000000002e",
  },
  // Submission and review (W4-03b): one creator who submits, is asked for changes, and is approved in
  // a real browser, and one whose review step is the subject of the visual and accessibility checks.
  reviewJourneyCreator: {
    sessionId: "01994b10-0000-7000-8000-000000000041",
    sessionToken: "e2e-review-journey-creator-session-token",
    userId: "01994b10-0000-7000-8000-000000000040",
  },
  reviewQualityCreator: {
    sessionId: "01994b10-0000-7000-8000-000000000043",
    sessionToken: "e2e-review-quality-creator-session-token",
    userId: "01994b10-0000-7000-8000-000000000042",
  },
  // The public catalog (W4-05): a creator whose approved collection is seeded with fixed content, so the
  // public pages can be checked visually in a known state.
  publicCollectionCreator: {
    sessionId: "01994b10-0000-7000-8000-000000000045",
    sessionToken: "e2e-public-collection-creator-session-token",
    userId: "01994b10-0000-7000-8000-000000000044",
  },
  // Images uploaded inside the wizard (UX-2): one creator who uploads a cover and a banner in the browser.
  collectionInlineCreator: {
    sessionId: "01994b10-0000-7000-8000-000000000061",
    sessionToken: "e2e-collection-inline-creator-session-token",
    userId: "01994b10-0000-7000-8000-000000000060",
  },
  // Many images at once (bulk upload): one creator who uploads a batch of named images in the browser.
  collectionBulkCreator: {
    sessionId: "01994b10-0000-7000-8000-000000000067",
    sessionToken: "e2e-collection-bulk-creator-session-token",
    userId: "01994b10-0000-7000-8000-000000000066",
  },
  // An applicant a reviewer has asked for changes (UX: the reviewer's message is shown to them).
  applicantFeedback: {
    sessionId: "01994b10-0000-7000-8000-000000000063",
    sessionToken: "e2e-applicant-feedback-session-token",
    userId: "01994b10-0000-7000-8000-000000000062",
  },
  collectionUnapproved: {
    sessionId: "01994b10-0000-7000-8000-000000000027",
    sessionToken: "e2e-collection-unapproved-session-token",
    userId: "01994b10-0000-7000-8000-000000000026",
  },
} as const;

// Actors the seed gives an approved creator application, so they may change collection drafts.
export const approvedCreators = [
  creatorE2EFixtures.collectionCreator,
  creatorE2EFixtures.collectionOtherCreator,
  creatorE2EFixtures.collectionAccessOwner,
  creatorE2EFixtures.collectionWizardCreator,
  creatorE2EFixtures.collectionQualityList,
  creatorE2EFixtures.collectionInlineCreator,
  creatorE2EFixtures.collectionBulkCreator,
  creatorE2EFixtures.collectionQualityWizard,
  creatorE2EFixtures.reviewJourneyCreator,
  creatorE2EFixtures.reviewQualityCreator,
  creatorE2EFixtures.publicCollectionCreator,
] as const;

// The application the seed gives `applicantFeedback`, and the reviewer's message on it.
export const feedbackApplication = {
  applicationId: "01994b10-0000-7000-8000-000000000064",
  eventId: "01994b10-0000-7000-8000-000000000065",
  feedback: "Please add a link to earlier work and say how the art was made.",
  // A fixed moment, so the page it appears on is the same every day.
  writtenAt: new Date("2026-10-10T12:30:00.000Z"),
} as const;

// The seeded approved collection the public pages are checked against.
export const publicCollection = {
  id: "01994b10-0000-7000-8000-000000000050",
  name: "Public light",
} as const;
