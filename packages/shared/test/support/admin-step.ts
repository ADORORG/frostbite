// A wire step as the staff routes answer it, for the contract tests.
export const adminStepId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
export const adminStep = {
  createdAt: "2026-10-16T12:00:00.000Z",
  createdBy: "Ada",
  createdContracts: [],
  delayed: false,
  failureReason: null,
  gameId: "arcade",
  id: adminStepId,
  operation: "set-claims-paused",
  recordable: false,
  recordedBy: null,
  sentAt: null,
  state: "awaiting-signature",
  submittedBy: null,
  templateRef: null,
  summary: {
    chain: "simnet:one",
    contractId: "rewards-1",
    expiresAt: "2026-10-16T12:10:00.000Z",
    fee: { asset: "sim", baseUnits: "1" },
    paused: true,
  },
  toSign: {
    chain: "simnet:one",
    family: "simulated",
    format: "f",
    payload: "{}",
  },
  transactionId: null,
};
