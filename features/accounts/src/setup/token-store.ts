import type { TokenStore } from "./setup-flow.ts";

const key = "platform-setup-token";

// The token in the browser's session storage, which lives as long as the tab. If the browser refuses storage the token is held in
// memory for the page's own lifetime, which is enough because signing in does not reload the page.
export function createSessionTokenStore(): TokenStore {
  let memory: string | null = null;
  return {
    clear() {
      memory = null;
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // Storage unavailable: nothing was saved there.
      }
    },
    read() {
      try {
        return window.sessionStorage.getItem(key) ?? memory;
      } catch {
        return memory;
      }
    },
    write(token) {
      memory = token;
      try {
        window.sessionStorage.setItem(key, token);
      } catch {
        // Storage unavailable: the in-memory copy is used.
      }
    },
  };
}
