// What the share control says. One catalogue, so the button, its menu and its feedback use the same words.
export const shareControlCopy = {
  button: "Share",
  copied: "Link copied",
  copy: "Copy link",
  copyFailed: "Could not copy. Select the address and copy it yourself.",
  linkFailed: "Could not make your link. Try again in a moment.",
  menu: "Share this",
  nativeTitle: "Share",
  opensNewTab: (label: string) => `${label} (opens in a new tab)`,
  preparing: "Making your link",
  signInRequired: "Sign in to share.",
} as const;
