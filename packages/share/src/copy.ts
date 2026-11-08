// What the share control says. One catalogue, so the button, its sheet and its feedback use the same words.
export const shareControlCopy = {
  button: "Share",
  copied: "Link copied",
  copy: "Copy",
  copyFailed: "Could not copy. Select the address and copy it yourself.",
  linkFailed: "Could not make your link. Try again in a moment.",
  linkLabel: "Link to share",
  nativeTitle: "Share…",
  opensNewTab: (label: string) => `${label} (opens in a new tab)`,
  preparing: "Making your link",
  sheetTitle: "Share",
} as const;
