import { ArcadeActionButton } from "../primitives/arcade-action-button.tsx";

// The button that asks the person's wallet to sign what is on screen, whatever it is (a step staff run, a claim a player makes): one
// place for its words, so the two never say it differently. While the wallet is being asked it cannot be pressed again.
export function ArcadeSignButton({
  disabled = false,
  onClick,
  working,
}: {
  // Nothing can be signed (no wallet that signs is connected): the button stays, so the person sees what they are missing.
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly working: boolean;
}) {
  return (
    <ArcadeActionButton
      busy={working}
      disabled={disabled}
      onClick={onClick}
      tone="mint"
    >
      {working ? "Waiting for your wallet…" : "Sign with your wallet"}
    </ArcadeActionButton>
  );
}
