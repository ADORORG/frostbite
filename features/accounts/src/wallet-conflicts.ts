// The two ways a wallet can be refused that are worth explaining, as the platform words them. The server sends these words and the page
// recognises them, so each is written once, here. They are given only after the wallet's signature verified: the person asking holds the
// wallet's key, so they learn nothing they could not learn by signing in with it. They say whether, never whose.
export const walletConflictMessages = {
  notOnAccount:
    "This wallet is not linked to your account, so it cannot confirm this change. Use one of your linked wallets.",
  held: "This wallet was recently removed from an account and is held for a while, so it cannot be used with another account yet. Try again later.",
  otherAccount:
    "This wallet is already linked to a different account. Sign in to that account and remove it there first, or use another wallet.",
} as const;
