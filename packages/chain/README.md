# `@ador/chain`

The chain boundary: neutral ports, the adapter registry, and the chain-family adapters behind them
([ADR-017](../../../docs/decisions/ADR-017-multichain-chain-family-adapters.md)). Nothing above this
package knows which chain family it is talking to.

## Public API

Neutral surface, safe for features, workers, and apps:

- `@ador/chain/ports` — the small ports (`AddressCodec`, `ChainReader`, `ContractGateway`,
  `TransactionBuilder`, `Broadcaster`, `ChainObserver`) and `InvalidAddressError`. Data types and
  schemas live in `@ador/shared/chain`.
- `@ador/chain/adapter` — `ChainAdapter`, `portCapabilities`, and `portNames`.
- `@ador/chain/registry` — `createChainRegistry`, which checks the configured chains against the
  registered adapters once at boot and then resolves a chain's config, adapter, ports, and
  capabilities.

Family-specific, allowed only where the repository boundary policy permits (this package, the wallet
bridge, `providers/chain/`, conformance tests, and the recorded `packages/auth/` exception):

- `@ador/chain/bitcoin-alkanes` — `createBitcoinAlkanesAdapter`, the `bitcoin-alkanes` family adapter, and what a caller needs to
  wire it to a node (`createRpcNode`, `createJsonRpc`, `AlkanesNode`, `TransactionOptions`). It always provides the address codec.
  Given a node per chain (`BitcoinAlkanesNodes`) it also provides the **rewards reader**: `claimed` (how many times a holder claimed
  a milestone) and `preview` (the picture, content type, issuer and edition of a collectible). Given transaction options as well
  it provides the **milestone-claim path**: the builder (a PSBT the player's wallet signs, with a summary of what it does), the
  signed-transaction check, the broadcaster, the observer (Bitcoin confirmation plus the indexer's trace), and the contract gateway
  (inspection, and a simulation that tells a player before they sign whether a claim would be refused). Given `administration` options too, the same builder also builds the
  **staff's steps** (publish a template, create a game, define a milestone, pause or resume claims): one transaction, or for a step that carries
  data in the witness (a drawing, a template's code) a commit-and-reveal pair sent as one `bitcoin-psbt-bundle` payload. No key is kept:
  the reveal's own input is signed with a one-time key destroyed within the build; the staff wallet signs the rest after reading the summary,
  and `verifySigned` proves the pair, the call, the data and the total fee are what the summary says. The auth token's output is named by
  `extension.adminOutput` ("txid:vout") and checked against the indexer and the game's `get_auth_token`. The adapter declares only what it provides.
  Inside `src/bitcoin-alkanes/`: `node/` is the application-owned node boundary (`AlkanesNode` over JSON-RPC, a minimal protobuf
  codec for the few indexer messages used, every answer validated, the trace decoder); `tx/` builds a claim (the
  protostone and runestone encoding ported from the indexer, fee and coin selection, the PSBT); `builder.ts`, `verify.ts`,
  `broadcaster.ts`, `observer.ts`, `contracts.ts`, `rewards.ts` and `inspect.ts` are the ports; `abi.ts` holds the template
  opcodes, and `milestone-key.ts` and `holder.ts` the rules shared with the contracts, all tested against the vector files in
  `contracts/templates/abi/`. Reads use the node directly, not `@alkanes/ts-sdk`, whose read results are loosely typed (`any`),
  return raw hex for simulations and need its WASM runtime; the SDK stays for the wallet and signing paths.
- `@ador/chain/bitcoin` — `validateBitcoinAddress` (P2WPKH and P2TR, mainnet or signet, `bitcoinjs-lib`
  7.0.2).
- `@ador/chain/alkanes` — `loadAlkanesSdk`, the isolated entrypoint for the immutable
  `@alkanes/ts-sdk@0.1.6-669e7c0` artifact.

## Invariants

- A chain is a CAIP-2 `ChainRef` from validated configuration. No chain identifier is hard-coded.
- Boot fails when an enabled chain has no adapter for its family, when two adapters claim a family,
  when an adapter does not support a chain it is configured for, when a feature needs a capability the
  adapter lacks, when an adapter provides a port it did not declare (or declares one it does not
  provide), and when a test-only adapter would serve a chain whose role is not `test`.
- Capability names declared by adapters or required by features must be well formed
  (`chainCapabilitySchema`); a malformed name fails boot.
- Disabled chains are configuration only: not resolvable, not checked.
- Broadcast is allowed on a `test` chain, and elsewhere only when the chain's release gate is open.
- The address codec returns the canonical form or throws `InvalidAddressError`; it never repairs input
  and never accepts another chain's address. Bitcoin address validation rejects whitespace,
  non-canonical case, checksum failures, cross-network input, and script types outside P2WPKH/P2TR.
  Signet shares the testnet address encoding, so an address alone cannot distinguish signet from
  testnet; provider and network agreement stays a separate authorization check.
- Family concepts (Alkane ids, PSBTs, protostones, view-function names) never appear in a port
  signature. SDK values do not cross this boundary without application-owned validation.

## Configuration and ownership

Which CAIP-2 chain is which Bitcoin network is passed to `createBitcoinAlkanesAdapter` from validated
configuration. Provider URLs, credentials, contract ids, and the chain list are not owned here. The
application's chain list is loaded into `createChainRegistry` by the first feature that needs it
(`W4-01`). Platform engineering owns this package.

## Tests

`ALKANES_LIVE_NODE_URL` (for example the public Subfrost mainnet endpoint) turns on `live-node.integration.test.ts`, which checks the
decoders against a real node; without it the test is skipped and no suite needs the network.

Run `typecheck`, `test:unit`, `test:integration`, or `test:coverage`. The conformance suite and the
simulated second family live in `@ador/test-kit` (`chain-conformance`, `simulated-chain`).

## Configured chains (`@ador/chain/configured`)

The one entry the platform's configuration uses to reach a chain. A `ConfiguredChain` is the chain's record plus its family's
adapter settings (`AdapterSettings`, a union with one member today: `bitcoin-alkanes`). `createConfiguredRegistry` builds the
adapters and the registry; `feeCeiling` states the fee limit in the chain's own currency. A new family adds its settings to the
union and its cases to `configured.ts`; callers reach it through the same neutral ports. The Alkanes assembly (node, transaction
options, administration templates) is `bitcoin-alkanes/settings.ts`; nothing in it has a default, the caller states every value.

## Where templates and contracts are

The adapter does not know where anything is published. A `publish-template` step names the address (`templateAt`), and a `deploy` step the
addresses of the game and collectible templates and how large a drawing the new contract accepts (`templateAt`, `collectibleAt`,
`maxDrawingBytes`); all appear in the summary staff sign, and the verifier rebuilds the call from the summary. Published code lives in block
4 (`{3, n}` publishes at `{4, n}`), so any other address is refused. A confirmed step's observation lists the contracts its trace created
(`created`, `decodeTraceCreated`): for a game made from its template, the game first and then its auth token. The fixture is the
indexer's own recording of a creation (`contracts/templates/abi/trace-vectors.json`, `creation`).
