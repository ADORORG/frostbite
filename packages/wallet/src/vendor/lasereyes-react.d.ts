import type { ReactNode } from "react";

declare module "@omnisat/lasereyes-react" {
  import type { Config } from "@omnisat/lasereyes-core";
  import type { LaserEyesProviderId } from "../conformance/contracts.ts";
  import type { WalletNetwork } from "../contracts.ts";

  export function LaserEyesProvider(props: {
    readonly children: ReactNode | readonly ReactNode[];
    readonly config?: Config;
  }): ReactNode;

  export const SUPPORTED_WALLETS: Readonly<
    Record<LaserEyesProviderId, Readonly<{ name: string; url: string }>>
  >;

  export function useLaserEyes(): {
    readonly address: string;
    readonly connected: boolean;
    readonly isConnecting: boolean;
    readonly network: WalletNetwork;
    readonly provider: LaserEyesProviderId | undefined;
    readonly hasBinance: boolean;
    readonly hasKeplr: boolean;
    readonly hasLeather: boolean;
    readonly hasMagicEden: boolean;
    readonly hasOkx: boolean;
    readonly hasOpNet: boolean;
    readonly hasOrange: boolean;
    readonly hasOyl: boolean;
    readonly hasPhantom: boolean;
    readonly hasSparrow: boolean;
    readonly hasTokeo: boolean;
    readonly hasUnisat: boolean;
    readonly hasWizz: boolean;
    readonly hasXverse: boolean;
    connect(provider: LaserEyesProviderId): Promise<void>;
    disconnect(): void;
    signMessage(
      message: string,
      options: { readonly toSignAddress: string; readonly protocol: "bip322" },
    ): Promise<string>;
  };
}
