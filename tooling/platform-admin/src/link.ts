import type { SetupLinkService } from "@frostbite/authorization";

// What the operator is told. The link is the only place the token ever appears: it is printed once, to this terminal, and is not
// stored anywhere readable (the database keeps only its hash).
export type SetupLinkReport =
  | { readonly expiresAt: Date; readonly kind: "minted"; readonly url: string }
  | { readonly kind: "admin-exists" };

// Mints the setup link and writes its address. The token goes after the `#`, which a browser never sends to a server, so it stays out
// of access logs, proxies and referrer headers; the platform's `/setup` page moves it out of the address bar on arrival.
export async function mintSetupLink(input: {
  readonly baseUrl: string;
  readonly service: Pick<SetupLinkService, "mint">;
}): Promise<SetupLinkReport> {
  const minted = await input.service.mint();
  if (minted.kind === "admin-exists") return minted;
  const url = new URL("/setup", input.baseUrl);
  url.hash = minted.token;
  return { expiresAt: minted.expiresAt, kind: "minted", url: url.href };
}

export function formatSetupLinkReport(report: SetupLinkReport): string {
  if (report.kind === "admin-exists")
    return "A working administrator already exists, so no setup link was made. Administrators are managed from the platform's role screen.";
  return [
    "Setup link (single use):",
    "",
    `  ${report.url}`,
    "",
    `Valid until ${report.expiresAt.toISOString()}. Open it in a browser, sign in with the wallet that will administer the platform, and it is spent.`,
    "Minting another link makes this one stop working. Do not share it or paste it into chat.",
  ].join("\n");
}

export function exitCodeOf(report: SetupLinkReport): 0 | 1 {
  return report.kind === "minted" ? 0 : 1;
}
