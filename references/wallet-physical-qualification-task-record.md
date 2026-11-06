# W2-10B — Physical wallet qualification and enablement

Status: in progress
Started: 2026-09-14
Last synchronized: 2026-10-04

## Message qualification implementation in progress

The user approved qualification-only signing/verification on 2026-10-04. It remains part of
W2-10B; the task has not been split or completed. Baseline: `828b3dcd34b79258066fa20f4b53cc4542ee6ff7`,
with a clean working tree. Working branch: `feat/wallet-message-qualification`.

Done for this portion means a configured connected candidate requests an expiring diagnostic
challenge, approves/rejects a BIP-322 message, and receives independent server verification without
creating a user, identity, session, cookie, or transaction. Expiry, altered messages, invalid input,
replay, concurrency, wrong origin, and wallet changes during approval must fail safely.

The flow composes existing feature registration, wallet client, shared schemas, framework-neutral
HTTP operations, strict verifier, and Drizzle adapter. Challenges use a separate table and cannot
be consumed by the authentication service. Only hashes and necessary temporary metadata are stored;
messages and signatures are not persisted or logged. Removing the feature's registration removes
its page, navigation, and operations. Authentication and PSBT enablement remain gated.

The migration is generated, not applied to the user's database. Run `pnpm db:migrate` before
physical testing. `/connect` exposes `Test message signing` after connection. A successful test is
not complete conformance evidence: exact wallet/browser/device versions and explicit physical
outcomes remain required. Diagnostic lifetime and attempt limits are configurable via
`configs/wallet.ts`, with named defaults in the shared qualification contract.

This is an internal qualification surface, not approval for public release. Public exposure still
requires milestone rate-limiting and challenge-retention hardening. Review and gate evidence is
recorded in `wallet-message-qualification-review.md`.

## Objective

Qualify configured candidates against the exact-pinned LaserEyes boundary on signet, then
enable only the capabilities supported by complete physical evidence.

## Implemented qualification surface

- Register a detachable `wallet-connection` feature requiring the generic `wallet:connect`
  capability.
- Expose `/connect` with qualification candidates selected in `configs/wallet.ts`.
- Keep all LaserEyes hooks, provider detection, and lifecycle calls inside `@frostbite/wallet/client`.
- State explicitly that connection is neither authentication nor provider qualification.
- Load the LaserEyes declaration augmentation as a type-only dependency so Next.js does not execute
  the declaration file at runtime.
- Expose the route through manifest-driven navigation and preserve one-line feature registration.

The development route has returned HTTP 200 after the declaration-boundary repair. This automated
and local evidence does not replace the physical qualification gate below.

## Remaining gate

On 2026-10-03 the user confirmed Oyl, Xverse, and UniSat connect successfully and return an
address. This is user-reported connection approval and address-retrieval evidence. Browser,
device, extension versions, and the network for each result were not supplied (the earlier Xverse
report explicitly named signet). Rejection, account/network changes, message verification,
PSBT verification, and the Alkanes fixture remain unverified; no production signing capability is enabled.

On 2026-10-03 the user reported a successful Xverse connection on signet and the connected address
state. This covers a reported connection approval only; wallet/browser versions, rejection, change
events, and signing evidence have not yet been supplied. The picker exposes configured browser
candidates supported by the pinned LaserEyes adapter through `configs/wallet.ts`, with
per-provider installed/unavailable detection. Each candidate still requires its own qualification.

The wallet chooser now opens in a native modal with explicit detection labels and consistent
connection-button styling. Installation links are separate from connection. Inspection of pinned
LaserEyes core 0.0.85 found that Phantom's detection depends on a DOM mutation and its connection
adapter rejects signet. The UI reports this network restriction rather than offering an installation
link as a remedy. Physical Phantom detection has not been verified in the user's browser.

## Modal verification

The modal shell is now a reusable, wallet-independent `ArcadeModal` under
`packages/ui/src/components/arcade-modal.tsx`. Wallet rows use a compact side-by-side layout with
a 28rem maximum modal width. The chooser now uses compact two-column action tiles, prioritizes
detected wallets, removes repeated row actions, and offers installation help only after a failed
connection to an undetected wallet. Browser tests assert no vertical overflow at the configured
screen sizes. Shared UI modal tests cover arbitrary content,
unique accessible labels, hydration protection, opening, and closing (10 UI tests; 100% coverage).

- `pnpm --filter @frostbite/feature-wallet-connection test:coverage`: 16 tests passed; 100% coverage.
- `pnpm --filter @frostbite/wallet test:coverage`: 55 tests passed; 100% coverage.
- Wallet and feature typecheck/lint passed; E2E typecheck/lint passed.
- `pnpm --filter web build`: passed with network access for the configured fonts.
- Modal Playwright checks passed at mobile, tablet, desktop, and wide viewports, including axe,
  keyboard traversal, Escape dismissal, focus restoration, reduced motion, and visual baselines.
- Mobile visual baseline was inspected for layout and readable availability labels.

These checks cover the chooser interface, not physical wallet signing qualification.

Connection progress now belongs to the selected candidate. Only that tile displays `Connecting…`
and announces a busy state; all tiles are disabled until the request settles. Regression tests hold
a connection promise open to verify sibling labels and duplicate-attempt prevention, then verify
control recovery after resolution and rejection.

User-reported connection failures exposed a candidate-selection gap: the pinned Sparrow adapter
requests manual console input and intercepts console.log rather than opening a browser extension.
Sparrow was removed from the browser chooser. Oyl reported an uninitialized wallet, a JSON-RPC
response reported no account, and Orange reported an absent provider. Vendor errors are now
narrowed at the wallet boundary into actionable setup, provider-availability, cancellation, or
generic recovery messages. Detection labels use `Detected`, which does not assert account readiness.

Error categories are explicit: `account-setup-required`, `provider-unavailable`, `cancelled`, and
`integration-failure`. Install links depend only on a reported missing provider, never on detection
flags or account setup errors. Tokeo/Keplr `wallet not found` responses are missing-provider errors;
undefined `connect` TypeErrors remain integration failures. Regression tests cover contradictory
detection flags to prevent setup failures from being mislabeled as missing extensions.

Physical testing must still cover connection approval/rejection, account and network changes,
message-signing approval/rejection and server verification, PSBT approval/rejection and server
verification, and the deterministic Alkanes fixture. No provider becomes supported and wallet
sign-in remains disabled until the evaluator accepts fresh, exact-version evidence.
