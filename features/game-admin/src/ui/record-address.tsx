import { ArcadeActionButton, ArcadeTextField } from "@repo/ui/arcade";
import { useState } from "react";

// For a creation that went through on the network but whose new contract the platform could not read: staff enter where the
// contract is. The platform checks that a contract is there and is made from the game's template before it records the address.
export function RecordAddress({
  onRecord,
  working,
}: {
  readonly onRecord: (address: string) => void;
  readonly working: boolean;
}) {
  const [address, setAddress] = useState("");
  return (
    <div data-testid="record-address">
      <p>
        The network created the contract, but the platform could not read where
        it is. Find it on a block explorer and enter it here. Nothing is
        recorded until the platform has checked it.
      </p>
      <ArcadeTextField
        label="Contract address"
        onChange={setAddress}
        value={address}
      />
      <ArcadeActionButton
        disabled={working || address.trim() === ""}
        onClick={() => onRecord(address)}
        tone="mint"
      >
        {working ? "Checking…" : "Check and record"}
      </ArcadeActionButton>
    </div>
  );
}
