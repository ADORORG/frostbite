import type {
  AlkanesSignerPort,
  SignedPsbt,
  SignPsbtOptions,
  WalletAccount,
  WalletNetwork,
} from "../contracts.ts";

export interface LaserEyesState {
  readonly address: string;
  readonly connected: boolean;
  readonly network: string;
  readonly provider: string | undefined;
  readonly publicKey: string;
}

export interface LaserEyesSignerDependencies {
  readonly client: LaserEyesSigningClient;
  readonly getState: () => LaserEyesState;
  readonly network: WalletNetwork;
}

export interface LaserEyesSigningClient {
  disconnect(): void;
  signMessage(
    message: string,
    options: { readonly toSignAddress: string },
  ): Promise<string>;
  signPsbt(options: {
    readonly broadcast: false;
    readonly finalize: boolean;
    readonly inputsToSign:
      | readonly { readonly address: string; readonly index: number }[]
      | undefined;
    readonly tx: string;
  }): Promise<
    | {
        readonly signedPsbtBase64: string | undefined;
        readonly signedPsbtHex: string | undefined;
        readonly txId?: string | undefined;
      }
    | undefined
  >;
}

function requireState(
  getState: () => LaserEyesState,
  expectedNetwork: WalletNetwork,
): LaserEyesState {
  const state = getState();
  if (!state.connected || state.provider === undefined) {
    throw new Error("A connected LaserEyes wallet is required.");
  }
  if (state.network !== expectedNetwork) {
    throw new Error("The connected wallet is on the wrong Bitcoin network.");
  }
  if (state.address.length === 0 || state.publicKey.length === 0) {
    throw new Error("The connected wallet account is incomplete.");
  }
  return state;
}

export function requireSignedPsbt(
  result: Awaited<ReturnType<LaserEyesSigningClient["signPsbt"]>>,
): SignedPsbt {
  if (
    result?.signedPsbtBase64 === undefined ||
    result.signedPsbtBase64.length === 0 ||
    result.signedPsbtHex === undefined ||
    result.signedPsbtHex.length === 0
  ) {
    throw new Error("LaserEyes returned an incomplete signed PSBT.");
  }
  if (result.txId !== undefined) {
    throw new Error(
      "LaserEyes broadcast a PSBT that was requested for signing only.",
    );
  }
  return {
    psbtBase64: result.signedPsbtBase64,
    psbtHex: result.signedPsbtHex,
  };
}

export function createLaserEyesSigner(
  dependencies: LaserEyesSignerDependencies,
): AlkanesSignerPort {
  const { client, getState, network } = dependencies;

  async function getAccount(): Promise<WalletAccount> {
    const state = requireState(getState, network);
    return { address: state.address, network, publicKey: state.publicKey };
  }

  async function signPsbt(
    psbt: string,
    options: SignPsbtOptions = {},
  ): Promise<SignedPsbt> {
    requireState(getState, network);
    const inputsToSign = options.inputsToSign?.map(({ address, index }) => ({
      address,
      index,
    }));
    const result = await client.signPsbt({
      broadcast: false,
      finalize: options.finalize ?? false,
      inputsToSign,
      tx: psbt,
    });
    return requireSignedPsbt(result);
  }

  return {
    network,
    disconnect: async () => client.disconnect(),
    getAccount,
    getAddress: async () => (await getAccount()).address,
    getPublicKey: async () => (await getAccount()).publicKey,
    getSignerType: () => "lasereyes",
    isConnected: async () => {
      const state = getState();
      return (
        state.connected &&
        state.provider !== undefined &&
        state.network === network &&
        state.address.length > 0 &&
        state.publicKey.length > 0
      );
    },
    signMessage: async (message) => {
      const state = requireState(getState, network);
      return client.signMessage(message, { toSignAddress: state.address });
    },
    signPsbt,
    signPsbts: async (psbts, options) => {
      const signed: SignedPsbt[] = [];
      for (const psbt of psbts) {
        // Wallet extensions generally present one approval prompt at a time.
        signed.push(await signPsbt(psbt, options));
      }
      return signed;
    },
  };
}
