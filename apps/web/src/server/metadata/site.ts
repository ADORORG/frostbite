import { parseEnvironment } from "@repo/config/env";

// Who the site is, from validated configuration: the public https origin the previews must point at (never the internal
// address the app listens on behind the proxy) and the product name.
export interface SiteIdentity {
  readonly name: string;
  readonly origin: string;
}

// The one place the site's identity is read from the process environment (an approved configuration adapter).
export function readSiteIdentity(
  source: NodeJS.ProcessEnv = process.env,
): SiteIdentity {
  const environment = parseEnvironment(source);
  return {
    name: environment.NEXT_PUBLIC_APP_NAME,
    origin: new URL(environment.PUBLIC_BASE_URL).origin,
  };
}

// The picture shown when a page has none of its own. Served by `app/share-image/route.tsx`.
export const defaultShareImage = {
  alt: "The arcade, with a snowfall sky and a row of game cabinets",
  height: 630,
  path: "/share-image",
  width: 1200,
} as const;
