import { Avatar } from "@repo/ui/arcade";
import type { AuthMethodsResponse } from "@ador/auth";

import { abbreviated, networkName } from "./format.ts";

// The wallets the account signs in with, and the passkeys it confirms changes with. A wallet can be removed while
// another remains; the only way in cannot be.
export function MenuWallets({
  busy,
  methods,
  onRemove,
}: {
  readonly busy: boolean;
  readonly methods: AuthMethodsResponse;
  readonly onRemove: (walletId: string) => void;
}) {
  const removable = methods.wallets.length > 1;
  return (
    <section aria-label="How you sign in" className="wallet-menu__section">
      <span className="wallet-menu__label">Your wallets</span>
      <ul aria-label="Linked wallets" className="wallet-menu__wallets">
        {methods.wallets.map((linked) => (
          <li data-wallet={linked.address} key={linked.id}>
            <Avatar seed={linked.address} size={20} />
            <span title={linked.address}>{abbreviated(linked.address)}</span>
            <small>{networkName(linked.network)}</small>
            {removable ? (
              <button
                aria-label={`Remove ${abbreviated(linked.address)}`}
                className="wallet-menu__action"
                disabled={busy}
                onClick={() => onRemove(linked.id)}
                type="button"
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {removable ? null : (
        <p className="wallet-menu__hint">
          This is your only way to sign in, so it cannot be removed. Link
          another wallet first.
        </p>
      )}
      {methods.passkeys.length === 0 ? null : (
        <p className="wallet-menu__hint">{`${String(methods.passkeys.length)} passkey linked (an added way to confirm changes, not a way to sign in).`}</p>
      )}
    </section>
  );
}
