// The connection library remembers the last wallet in the browser and reconnects to it a moment after the page loads
// (it waits for extensions to appear first). While that is pending the wallet is not yet connected, but one is about
// to be, and the page can say so instead of looking as if there were none. This reads only whether a wallet is
// remembered, never which account it had; a browser that refuses storage simply has none.
export const rememberedWalletKey = "defaultWallet";

export function hasRememberedWallet(): boolean {
  try {
    return (localStorage.getItem(rememberedWalletKey) ?? "") !== "";
  } catch {
    return false;
  }
}
