// Timing for the browser's polling and refresh behavior. Typed values rather than literals in
// components, so they are visible, overridable in tests, and validated in one place.
export interface UploadClientPolicy {
  // Most files one batch upload accepts at a time; the rest are reported as not added.
  readonly bulkFileLimit: number;
  // Most files of one batch under way at once, being sent or being checked and processed. The batch waits
  // for room, so the server's queue stays short and every image is watched well inside the time allowed.
  readonly bulkInFlightLimit: number;
  // How long to wait between checks while an asset is being validated and processed.
  readonly pollIntervalMs: number;
  // Checks before the UI stops waiting and tells the user processing is still running.
  readonly pollMaxAttempts: number;
  // Signed rendition URLs are refreshed this long before they expire.
  readonly signedUrlRefreshMarginMs: number;
  // How long a file may be sent with no sign of progress before the upload is given up on and offered again.
  readonly transferStallMs: number;
  // Floor for any scheduled refresh, so a clock skew cannot create a tight loop.
  readonly minimumRefreshDelayMs: number;
}

export const defaultUploadClientPolicy: UploadClientPolicy = Object.freeze({
  bulkFileLimit: 500,
  bulkInFlightLimit: 8,
  minimumRefreshDelayMs: 5_000,
  pollIntervalMs: 1_500,
  pollMaxAttempts: 80,
  signedUrlRefreshMarginMs: 30_000,
  transferStallMs: 30_000,
});

export function resolveUploadClientPolicy(
  overrides: Partial<UploadClientPolicy> = {},
): UploadClientPolicy {
  const policy = { ...defaultUploadClientPolicy, ...overrides };
  for (const [name, value] of Object.entries(policy))
    if (!Number.isInteger(value) || value < 1)
      throw new Error(
        `Upload client policy ${name} must be a positive integer.`,
      );
  return Object.freeze(policy);
}
