# Wallet connection feature

Public, qualification-only wallet UI. It depends on generic `wallet:connect` and `wallet:message-sign`
provider capability and consumes the normalized `@ador/wallet/client` boundary; feature code never
calls an individual wallet extension.

Register `createWalletConnectionFeature(config)` once in `configs/features.ts`. Removing that line
removes the page, navigation, and qualification operations. Candidate wallets and the Bitcoin network are validated
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

## Message-signing qualification

The feature also requires `wallet:message-sign`. After connecting, `Test message signing` requests
a qualification-only message and asks the normalized adapter for BIP-322; there is no legacy fallback.
Framework-neutral operations live in `src/application`, schemas/routes in
`@ador/shared/wallet-qualification`, and the cached server composition in `src/runtime.ts`.
The auth-owned diagnostic service uses the existing strict verifier and a dedicated Drizzle table.
No diagnostic path calls the authentication service or emits a session-cookie effect.

Successful verification is single-use and atomic; failures consume bounded attempts. Expired,
modified, replayed, wrong-origin, wrong-network, or unconfigured candidate requests fail closed.
The browser discards work after disconnection, unmount, or account/network/provider changes.
Only hashes and temporary challenge metadata are persisted, never signatures or full messages.

Policy defaults are named in the shared contract (five-minute expiry, three verification attempts)
and can be overridden in `configs/wallet.ts`. The attempt bound must be a positive integer no larger
than the PostgreSQL `integer` ceiling (`walletQualificationMaximumAttemptsLimit`); configuration
and the service both reject larger values at startup. Platform engineering owns this diagnostic feature.
Run `pnpm db:migrate` to apply the generated table migration before physical testing. Tests use
disposable PostgreSQL; no configured user database is mutated by the test suite.

This is an internal qualification tool. Public-release rate limits and expired-record cleanup remain
milestone hardening gates; a successful signature test does not enable sign-in, PSBT signing, or
wallet support. Physical evidence is recorded separately, without addresses/signatures/keys.
