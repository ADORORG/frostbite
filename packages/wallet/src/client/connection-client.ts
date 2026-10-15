import type { WalletNetwork } from "../contracts.ts";
import type { LaserEyesProviderId } from "../conformance/contracts.ts";

// The wallet connection as the app sees it, whatever library is behind it.
export interface WalletConnectionClient {
  readonly address: string;
  readonly connected: boolean;
  readonly connecting: boolean;
  readonly network: WalletNetwork;
  readonly provider: LaserEyesProviderId | null;
  connect(provider: LaserEyesProviderId): Promise<void>;
  disconnect(): void;
  signMessage(message: string): Promise<string>;
  isInstalled(provider: LaserEyesProviderId): boolean;
  installationUrl(provider: LaserEyesProviderId): string;
}

// What the connection says while the wallet library has not been loaded: nothing is connected and nothing is installed, as
// far as anyone can know yet. Connecting asks for the library and then connects with it.
export function idleConnection(
  network: WalletNetwork,
  connectWhenLoaded: (provider: LaserEyesProviderId) => Promise<void>,
): WalletConnectionClient {
  return {
    address: "",
    connect: connectWhenLoaded,
    connected: false,
    connecting: false,
    disconnect: () => undefined,
    installationUrl: () => {
      throw new Error("The wallet library has not been loaded yet.");
    },
    isInstalled: () => false,
    network,
    provider: null,
    signMessage: () =>
      Promise.reject(new Error("A connected wallet account is required.")),
  };
}
