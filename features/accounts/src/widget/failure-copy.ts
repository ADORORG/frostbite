import { walletConflictMessages } from "../wallet-conflicts.ts";
import type { Failure } from "../client/wallet-session.ts";

// What a player is told when a step did not work. None of it says whose a wallet is; two say whether it is another account's or is held, which
// the server tells only to whoever has just proved they hold the wallet's key.
export const failureCopy: Record<Failure, string> = {
  network: "The request did not reach the platform. Try again.",
  "not-connected": "Connect a wallet first.",
  "not-verified":
    "The wallet could not be verified. Try again with a fresh signature.",
  "recent-authentication-required":
    "To change this, sign in again with your wallet first.",
  "refused-by-wallet": "The wallet did not sign. Nothing was changed.",
  "unavailable-wallet": "This wallet cannot be used for that.",
  "wallet-held": walletConflictMessages.held,
  "wallet-on-another-account": walletConflictMessages.otherAccount,
  "wallet-changed":
    "The wallet changed while you were signing. Nothing was changed.",
};
