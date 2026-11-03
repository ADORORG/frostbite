import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { platformSessionCookieName } from "@ador/shared/auth";
import { Bungee, Chakra_Petch, Press_Start_2P } from "next/font/google";
import { IndexingBadge } from "@ador/feature-chain-status/badge";
import { AnimationToggle, ScenesProvider } from "@ador/scenes/react";
import { ShellStatusProvider } from "@repo/ui/arcade";
import "@repo/ui/styles.css";
import "@ador/scenes/styles.css";
import "./globals.css";
import { chainStatusConfig } from "@repo/configs/chain-status";
import { walletAuthConfig } from "@repo/configs/wallet";
import { getPageAccessDependencies } from "../server/auth/runtime";
import { readSessionState } from "../server/auth/session-state";
import { siteMetadata } from "../server/metadata/next-metadata";
import { readSiteIdentity } from "../server/metadata/site";
import { ClientNavigation } from "./client-navigation";
import { sceneVideoBase } from "./scene-videos";
import { WalletShell } from "./wallet-shell";

const bodyFont = Chakra_Petch({
  subsets: ["latin"],
  variable: "--font-chakra",
  weight: ["400", "500", "600", "700"],
});
const displayFont = Bungee({
  subsets: ["latin"],
  variable: "--font-bungee",
  weight: "400",
});
const pixelFont = Press_Start_2P({
  subsets: ["latin"],
  variable: "--font-press-start",
  weight: "400",
});

// The public origin and the name come from configuration read when the page is asked for, not when the image was built.
export function generateMetadata(): Metadata {
  return siteMetadata(readSiteIdentity());
}

// Tells the validation library, before any of its code runs, not to compile schemas at run time. Compiling
// needs script evaluation, which the content security policy does not allow; the library probes for it and the
// browser reports the probe as a violation. Validation behaves the same either way.
const validationSetup = "globalThis.__zod_globalConfig={jitless:true};";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The policy lets only scripts with this response's nonce run, and this one is ours.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const session = await readSessionState(
    (await cookies()).get(platformSessionCookieName)?.value,
    getPageAccessDependencies,
  );
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable} ${pixelFont.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: validationSetup }}
          nonce={nonce}
        />
      </head>
      <body>
        <ClientNavigation />
        <ScenesProvider videoBase={sceneVideoBase}>
          <ShellStatusProvider
            status={
              <IndexingBadge
                polling={chainStatusConfig.polling}
                syncWindowBlocks={chainStatusConfig.syncWindowBlocks}
              />
            }
          >
            <WalletShell
              balanceRefreshMs={walletAuthConfig.balanceRefreshMs}
              candidates={walletAuthConfig.candidates}
              network={walletAuthConfig.network}
              reconnectWaitMs={walletAuthConfig.reconnectWaitMs}
              session={session}
            >
              {children}
            </WalletShell>
          </ShellStatusProvider>
          <AnimationToggle />
        </ScenesProvider>
      </body>
    </html>
  );
}
