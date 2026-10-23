import type { WalletNetwork } from "@ador/shared/chain";

export type { WalletNetwork };

export interface WalletAccount {
  readonly address: string;
  readonly network: WalletNetwork;
  readonly publicKey: string;
}

export interface SignPsbtOptions {
  readonly finalize?: boolean;
  readonly inputsToSign?: readonly {
    readonly address: string;
    readonly index: number;
  }[];
}

export interface SignedPsbt {
  readonly psbtBase64: string;
  readonly psbtHex: string;
}

export interface AlkanesSignerPort {
  readonly network: WalletNetwork;
  disconnect(): Promise<void>;
  getAccount(): Promise<WalletAccount>;
  getAddress(): Promise<string>;
  getPublicKey(): Promise<string>;
  getSignerType(): string;
  isConnected(): Promise<boolean>;
  signMessage(message: string): Promise<string>;
  signPsbt(psbt: string, options?: SignPsbtOptions): Promise<SignedPsbt>;
  signPsbts(
    psbts: readonly string[],
    options?: SignPsbtOptions,
  ): Promise<readonly SignedPsbt[]>;
}
