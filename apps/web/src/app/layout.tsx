import type { Metadata } from "next";
import { headers } from "next/headers";
import { Bungee, Chakra_Petch, Press_Start_2P } from "next/font/google";
import "@repo/ui/styles.css";
import "./globals.css";
import { walletAuthConfig } from "../../../../configs/wallet";
import { ClientNavigation } from "./client-navigation";
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

export const metadata: Metadata = {
  title: "Adorbitals — Launch on Bitcoin",
  description: "A self-custodial launchpad and arcade for Bitcoin Alkanes.",
};

// Tells the validation library, before any of its code runs, not to compile schemas at run time. Compiling
// needs script evaluation, which the content security policy does not allow; the library probes for it and the
// browser reports the probe as a violation. Validation behaves the same either way.
const validationSetup = "globalThis.__zod_globalConfig={jitless:true};";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The policy lets only scripts with this response's nonce run, and this one is ours.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
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
        <WalletShell
          balanceRefreshMs={walletAuthConfig.balanceRefreshMs}
          candidates={walletAuthConfig.candidates}
          network={walletAuthConfig.network}
          reconnectWaitMs={walletAuthConfig.reconnectWaitMs}
        >
          {children}
        </WalletShell>
      </body>
    </html>
  );
}
