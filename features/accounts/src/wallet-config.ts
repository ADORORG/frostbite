// The platform's wallet sign-in policy: values that are the business's to decide, not the environment's. Supplied by
// the platform's configuration (`configs/wallet-auth.ts`), so changing one is a reviewed change.
export interface WalletAuthConfig {
  // How long a challenge can be signed before it lapses.
  readonly challengeLifetimeMs: number;
  // How many wrong signatures a challenge tolerates before it is dead.
  readonly maximumVerificationAttempts: number;
  // How long a wallet an account removed cannot be taken by another account.
  readonly releaseHoldMs: number;
}
