# `@frostbite/wallet`

The single platform boundary around the exact-pinned LaserEyes React/Core pair.

## Public API

- `WalletProvider` composes LaserEyes without exposing wallet-specific adapters, and the wallet-chooser state:
  `useWalletChooser()` returns `{ open, request, dismiss }`. A feature that needs a wallet calls `request()`; the app's
  header widget renders the chooser. Mount the provider once for the whole app (the layout does).
- **The LaserEyes library (about 600 KB gzipped) is loaded on demand**, as a chunk of its own (`live-connection.tsx`), and not on
  a page that never needs a wallet. It is fetched when a wallet was remembered from an earlier visit (so it can reconnect),
  when the chooser is requested, or when something connects. Until it loads, `useWalletConnection()` is an idle connection
  (nothing connected, nothing installed); a connect made meanwhile waits for the library and for it to find the wallet asked for
  (up to 3 seconds), then connects. A test in a real browser fails if the library is fetched on page load.
- `useWalletConnection().signMessage` requires a connected account and explicitly requests BIP-322
  for its address. This diagnostic primitive does not establish a session or qualify wallet support.
- `useStepWallet(allowedProviders)` (client) is the connected wallet as a signer of the platform's own transactions: `sign` is present
  only while a wallet on the deployment's list is connected. `signWithWallet` (bridge) asks the wallet, one PSBT at a time, to sign
  only the inputs nobody has signed (`@frostbite/chain/wallet-signing`: `walletRequests`, `withWalletSignatures`), finalised and never
  sent, and puts the answers back; the platform then checks the result against what it built. Today the `bitcoin-alkanes` family;
  another family adds its own mapping beside it.
- `@frostbite/wallet/registration` contributes LaserEyes through one explicit provider-registry entry.
- `createLaserEyesSigner` adapts one connected LaserEyes client to the narrow signer contract used
  by Alkanes application services.
- Wallet contracts normalize account, network, and signed-PSBT results without leaking broad vendor
  response types.
- `@frostbite/wallet/conformance` evaluates explicit device/browser evidence and returns only candidates
  whose requested capabilities have a complete passing matrix for the pinned LaserEyes versions.

## Invariants

Signing requires a connected provider, the configured network, and a complete account. The bridge
always requests signing without broadcast and rejects an unexpected transaction ID or incomplete
PSBT encodings. Application and server layers must independently validate addresses, challenges,
signatures, transaction intent, and returned PSBTs.

No wallet is enabled merely because LaserEyes exposes it. Provider enablement requires the shared
device/browser/network/operation conformance suite. The platform does not use LaserEyes' deprecated
Alkanes construction APIs or SDK keystore/mnemonic features.

## Temporary compatibility exception

The user approved LaserEyes React 0.0.80/Core 0.0.85 despite Core's deprecated transitive `alkanes`
dependency because the ecosystem integration currently relies on this published pair. Top-level
versions remain exact, and the floating Git transitive dependency is overridden to commit
`7a3326b12702c044424d10b37c048e06ebefb3d2` for reproducibility. The exception does not permit direct
imports from deprecated `alkanes`, does not qualify its transaction behavior, and must be removed
when LaserEyes publishes a compatible release without that dependency.

The resolved graph currently carries a high-severity Valibot advisory. LaserEyes React is
pre-bundled, so module provenance cannot prove that its transitive implementation is absent from the
client artifact. The adapter is registered, but no individual wallet or wallet-input flow is
enabled by registration alone. The accepted beta exception is recorded in the advisory task record;
wallet activation still requires conformance evidence.

Removing the single entry from `configs/providers.ts` removes the adapter's capabilities without
changing app routes, features, or wallet-specific conditionals.

Network selection is provided by validated configuration. Platform engineering owns this package.
Run its `typecheck`, `test:unit`, `test:integration`, or `test:coverage` scripts.

## Conformance boundary

The evaluator is the shared automated half of wallet qualification. A deployment supplies typed
candidates with exact wallet versions, an explicit browser/device/network/address/signing-scheme
policy, deterministic fixture identity, and physical evidence. Empty policy dimensions, missing
checks, duplicate candidates/capabilities or evidence, failures, stale/future timestamps, and
version/fixture drift all fail closed.

Physical runs record only environment metadata, fixture identity, time, and outcome. Never record
wallet addresses, keys, signatures, PSBT contents, balances, extension profiles, or seed material.
No individual provider is currently advertised; that requires the separate W2-10B physical gate.

## Ownership

Platform engineering.
