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
  visualUser: {
    sessionId: "01994b10-0000-7000-8000-00000000000a",
    sessionToken: "e2e-visual-session-token",
    userId: "01994b10-0000-7000-8000-000000000009",
  },
} as const;
