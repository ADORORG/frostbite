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
  creatorE2EFixtures.collectionQualityWizard,
] as const;
