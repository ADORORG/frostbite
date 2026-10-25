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
    // Like the wallet steps: signing in is a guess an attacker can repeat. A person makes one of each.
    beginPasskeySignIn: perMinute(10),
    // Signing in is a guess an attacker can repeat, so every wallet step is tight: a challenge a few at a time, a
    // signature a few more (a real player makes one of each).
    beginWalletLink: perMinute(10),
    beginWalletSignIn: perMinute(10),
    beginWalletStepUp: perMinute(10),
    completeUploadIntent: perMinute(120),
    createCollectionDraft: perMinute(20),
    // Browsers report policy violations here without being asked; a page that violates one reports it often.
    cspReport: perMinute(30),
    createUploadIntent: perMinute(120),
    decideCollectionReview: perMinute(60),
    finishPasskeyRegistration: perMinute(10),
    finishPasskeySignIn: perMinute(20),
    // A balance asks an outside data source, and anyone may ask: a few a minute covers the widget's refresh and a
    // manual one with room to spare.
    getWalletBalance: perMinute(30),
    importCollectionItems: perMinute(20),
    // Opening a setup link is for the one person setting up the platform; a token cannot be guessed, but nothing needs more than a few.
    redeemSetupLink: perMinute(10),
    // Each request sends a real message, which costs money and can annoy whoever owns the address, so a caller gets a few a minute on top of
    // the per-address limits the code service keeps. Entering a code is a guess, so it is as tight as the other sign-in steps.
    requestEmailCode: perMinute(5),
    // Adding an address also sends a real message, and entering its code is a guess; so the same limits as signing in by email.
    requestEmailLinkCode: perMinute(5),
    reviewCreatorApplication: perMinute(60),
    signOut: perMinute(30),
    // A run is started when a game begins a round and submitted when it ends; a replay costs the server real work, so these
    // are far tighter than a save.
    startGameRun: perMinute(30),
    submitCollection: perMinute(10),
    submitCreatorApplication: perMinute(10),
    submitGameRun: perMinute(30),
    // Sent when a game is opened and after each save or unlock, so it is the busiest write; one a second.
    syncGameState: perMinute(120),
    unlinkEmailAddress: perMinute(10),
    unlinkPasskey: perMinute(10),
    unlinkWallet: perMinute(10),
    verifyEmailCode: perMinute(20),
    verifyEmailLinkCode: perMinute(20),
    verifyWalletLink: perMinute(20),
    verifyWalletSignIn: perMinute(20),
    verifyWalletStepUp: perMinute(20),
  },
  read: perMinute(600),
  version: 1,
  write: perMinute(120),
});
