import { rateLimitConfigSchema } from "@ador/shared/http";

const perMinute = (limit: number) => ({ limit, windowMs: 60_000 });

// How much each kind of caller may do, as a record: a change is a new version. Numbers are generous for normal
// use (a bulk upload sends about two files a second) and tight where a flood is costly or a guess is the attack:
// signing in, wallet challenges, passkeys, and submitting. A caller over a limit is answered 429 with how long
// to wait. See docs/operations/runbook-upload-failures.md for what a person sees.
export const rateLimits = rateLimitConfigSchema.parse({
  address: perMinute(600),
  anonymous: perMinute(60),
  operations: {
    addCollectionItem: perMinute(120),
    beginPasskeyRegistration: perMinute(10),
    beginWalletQualification: perMinute(10),
    completeUploadIntent: perMinute(120),
    createCollectionDraft: perMinute(20),
    // Browsers report policy violations here without being asked; a page that violates one reports it often.
    cspReport: perMinute(30),
    createUploadIntent: perMinute(120),
    decideCollectionReview: perMinute(60),
    finishPasskeyRegistration: perMinute(10),
    importCollectionItems: perMinute(20),
    reviewCreatorApplication: perMinute(60),
    submitCollection: perMinute(10),
    submitCreatorApplication: perMinute(10),
    unlinkPasskey: perMinute(10),
    verifyWalletQualification: perMinute(20),
  },
  read: perMinute(600),
  version: 1,
  write: perMinute(120),
});
