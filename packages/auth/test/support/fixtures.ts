import { createUuidV7 } from "@ador/shared/identifiers";
import { Signer } from "bip322-js";

export const walletPrivateKey =
  "L3VFeEujGtevx9w18HD1fhRbCH67Az2dpCymeRE1SoPK6XQtaN2k";
export const walletAddress = "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v";

export function signWalletMessage(message: string): string {
  return Signer.sign(walletPrivateKey, walletAddress, message);
}

export const walletAuthPolicy = {
  challengeLifetimeMs: 60_000,
  maximumVerificationAttempts: 2,
  sessionAbsoluteLifetimeMs: 86_400_000,
  sessionIdleLifetimeMs: 3_600_000,
};

export function validChallengeInput() {
  return {
    action: "sign-in" as const,
    address: walletAddress,
    network: "signet" as const,
    origin: "https://launch.example",
    requestId: createUuidV7(),
    uri: "https://launch.example/auth/wallet",
    walletAdapter: "lasereyes",
  };
}

// Deterministic wallets that exist only in tests, each with a signet address and its private key (WIF), so a test
// can have a wallet of its own without sharing an account with another test. They hold nothing and are in no
// production bundle.
export const testWallets = [
  {
    address: "tb1quh9vv9008jqcct245xc98rp73qkjjfapr5eya8",
    privateKey: "cMfjRztSfzXPWXFCDvoruVuvpcqAp1o2iQTFeYkyZfyVxUK5nRGx",
  },
  {
    address: "tb1qmdts2hrqvgfek8lmk9365k3qh9dyy555s4h9xp",
    privateKey: "cPHiaKoYqMDNge32tYVCSpnpnKBoXZv7Av4BXuioJ9zXWKLhjGKp",
  },
  {
    address: "tb1q2tvudr69nap5uu8f6f0hdymp6zngwllayqdqpn",
    privateKey: "cSGeY82jxR8izbVJKsySZvQujB6Jo7J6zM3c2jAQumwSeuUDHrHg",
  },
  {
    address: "tb1qxe73fjmlmz9ca9g65pxakp90k8n9uxy4hccf9u",
    privateKey: "cN2d144pUnTN9AGDjNKG2m8m8Ssisdx5GFB822K77gDC5DANkF17",
  },
  {
    address: "tb1qkdwc9lef8u8cfh6rtqmm8l702pgt0l893gr0ce",
    privateKey: "cW4o7jn8gnnm9qVohzrEpWsEGb7ZFTU1cDtXWR4rM53AuT5Ur9SQ",
  },
  {
    address: "tb1qrwdc7te7jljzuf46v2zdsqat2zwd6uarvnsupt",
    privateKey: "cUVTfGdFzCWSmor9tbR6AjEPiwdfwQpUn8duqc8Lt4NnPNSBCsUU",
  },
  {
    address: "tb1q72hsfuknp42gufda2ct9zzjsn7fgpmq5jkjf7f",
    privateKey: "cUYfJXqXJKBRf9Z4Di4sD9XThJdCLrK869Cm4bHFriL57ZLmfEbG",
  },
  {
    address: "tb1qjg2yhc9l0esc86f7rak0psclgqf3yd9qcas794",
    privateKey: "cUA5RiKwBWxEmj9y8FBjR9WeetWJEfECzrQb3sihjqV3MZiNYMAe",
  },
  {
    address: "tb1q8lthtjpmwdx7a8xwqk44cqzp03ngjknqsuk96n",
    privateKey: "cPzhqwcJaJpeS3M8dX5QK7vKAuT34V34erT12zw2kU1X4atqggHB",
  },
  {
    address: "tb1qhyszzra4m43tzz89l25xtherl8g0cxgsa5ztus",
    privateKey: "cVRSxgLY8SznXTBXSmydG98h1FZhXdJx3HptGtZfxgdE8eF4uNGP",
  },
  {
    address: "tb1q48fc2qwzufk7jx92lglu4xh8nzpj63cwyurqhw",
    privateKey: "cRdLULghWXiwqUTRo5y8TDuDBsZsiSJafSvXbEaSYYUSen25MRdS",
  },
  {
    address: "tb1qnzjy4slg7av6c08az4fr28zjtgj08kfscjh82s",
    privateKey: "cPuZkyKfLbPSsX4TnB5HRHy3opkz8VsHx6hZqTbfjWLgRoh35sLP",
  },
] as const;

export function signAs(
  wallet: { readonly address: string; readonly privateKey: string },
  message: string,
): string {
  return Signer.sign(wallet.privateKey, wallet.address, message);
}
