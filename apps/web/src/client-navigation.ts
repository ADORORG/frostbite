// Which clicks on a link the app moves to by itself, without loading the page again. Loading again starts the whole
// app over, and the wallet connection with it (the connection library waits before it reconnects), so a person who
// moves between pages would see their wallet disappear and come back each time. Pages are still rendered on the
// server; only the full reload is avoided.

// Paths that are not pages: API routes answer data, and game bundles are static files the router has no page for.
// A link to one is left to the browser.
const notPages = ["/api/", "/play/"] as const;

const plainLeftClick = (event: MouseEvent) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

// The page address to move to for this click, or null when the browser should handle it (a new tab, a download, another
// site, a file, a jump within the page, or a modified click).
export function clientNavigationTarget(
  event: MouseEvent,
  current: Pick<Location, "href" | "origin" | "pathname" | "search">,
): string | null {
  if (!plainLeftClick(event)) return null;
  const anchor =
    event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target !== "" && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  if (anchor.relList.contains("external")) return null;
  const url = new URL(anchor.getAttribute("href") ?? "", current.href);
  if (url.origin !== current.origin) return null;
  if (notPages.some((prefix) => url.pathname.startsWith(prefix))) return null;
  // The same page (a jump to a heading, or a click on where you already are) is the browser's to handle.
  if (url.pathname === current.pathname && url.search === current.search)
    return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
