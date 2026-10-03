# Wallet connection feature

Public, qualification-only wallet connection UI. It depends on the generic `wallet:connect`
provider capability and consumes the normalized `@ador/wallet/client` boundary; feature code never
calls an individual wallet extension.

Register `createWalletConnectionFeature(config)` once in `configs/features.ts`. Removing that line
removes the route and navigation. Candidate wallets and the Bitcoin network are validated
configuration. A successful connection is not authentication and does not enable a provider;
W2-10B physical evidence remains authoritative.

Wallet choices live only in `configs/wallet.ts`: add or remove one candidate entry to change the
picker. The chooser consumes the shared `ArcadeModal` component from `@repo/ui/arcade` for
focus containment, Escape dismissal, and focus restoration. Compact two-column wallet tiles are
the connection actions; detected wallets appear first. Repeated connection buttons and installation
links are omitted. Installation help appears after a failed connection to an undetected wallet.
Connection remains available when detection is delayed. Known
adapter network restrictions are owned by `@ador/wallet/client` and disable connection with a reason.
Listing a wallet means it is a connection candidate, not that its signing capabilities are qualified.

Run `typecheck`, `test:unit`, `test:integration`, or `test:coverage` from this workspace.
