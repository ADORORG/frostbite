import { embeddedGameRoot } from "../../packages/shared/src/games/manifest.ts";
import { gameResponseHeaders } from "../../packages/game-sdk/src/frame-headers.ts";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: false,
  },
  // The games the platform plays in its own isolated frame: sandboxed, with no network of their own.
  headers: async () => [
    { headers: gameResponseHeaders(), source: `${embeddedGameRoot}/:path*` },
  ],
  output: "standalone",
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  poweredByHeader: false,
  transpilePackages: [
    "@repo/configs",
    "@ador/feature-platform-shell",
    "@ador/http",
    "@ador/plugin-kit",
    "@ador/scenes",
    "@ador/shared",
    "@repo/ui",
  ],
  typedRoutes: true,
};

export default nextConfig;
