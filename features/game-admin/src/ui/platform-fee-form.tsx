"use client";

import type {
  GetPlatformFeeResponse,
  SetPlatformFeeInput,
  SetPlatformFeeResponse,
} from "@frostbite/shared/games";
import { ArcadeActionButton, ArcadeTextField } from "@repo/ui/arcade";
import { useState } from "react";

import { platformFeeRefusalCopy, unitsLabel } from "../domain/mint-copy.ts";

type ChainFee = GetPlatformFeeResponse["chains"][number];

// Sets the fee and the address it is paid to, side by side: one without the other would be half a decision, so they are saved together
// and the platform checks both before it keeps either. Zero means no fee.
export function PlatformFeeForm({
  chain,
  onSave,
}: {
  readonly chain: ChainFee;
  readonly onSave: (
    input: SetPlatformFeeInput,
  ) => Promise<SetPlatformFeeResponse>;
}) {
  const [fee, setFee] = useState(chain.current?.feeUnits ?? "0");
  const [treasury, setTreasury] = useState(chain.current?.treasury ?? "");
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<{
    readonly kind: "alert" | "status";
    readonly text: string;
  } | null>(null);
  const digits = /^(?:0|[1-9][0-9]{0,18})$/u.test(fee.trim());
  const unchanged =
    chain.current !== null &&
    chain.current.feeUnits === fee.trim() &&
    chain.current.treasury === treasury.trim();
  const save = async () => {
    setWorking(true);
    setNote(null);
    try {
      const answer = await onSave({
        chain: chain.chain,
        feeUnits: fee.trim(),
        treasury: treasury.trim(),
      });
      setNote(
        answer.status === "saved"
          ? {
              kind: "status",
              text:
                answer.setting.feeUnits === "0"
                  ? "Saved. Claims carry no platform fee."
                  : `Saved. Each claim now carries ${unitsLabel(answer.setting.feeUnits)} for the platform.`,
            }
          : { kind: "alert", text: platformFeeRefusalCopy(answer) },
      );
    } catch {
      setNote({
        kind: "alert",
        text: "The platform did not answer, so nothing is known to have changed. Look at the current fee above and try again.",
      });
    } finally {
      setWorking(false);
    }
  };
  return (
    <form
      aria-label={`Platform fee on ${chain.chain}`}
      className="arcade-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="fee-fields">
        <ArcadeTextField
          error={
            digits ? null : "Whole satoshis, in digits only (0 for no fee)."
          }
          hint={`Most allowed: ${unitsLabel(chain.maximumFeeUnits)}.`}
          inputMode="numeric"
          label="Fee per claim (sats)"
          maxLength={19}
          onChange={setFee}
          value={fee}
        />
        <ArcadeTextField
          autoComplete="off"
          hint="Where the fee is paid. Checked against this network before it is saved."
          label="Treasury address"
          maxLength={256}
          onChange={setTreasury}
          value={treasury}
        />
      </div>
      <ArcadeActionButton
        busy={working}
        disabled={!digits || treasury.trim() === "" || unchanged}
        tone="mint"
        type="submit"
      >
        {working ? "Saving…" : "Save fee and address"}
      </ArcadeActionButton>
      {note === null ? null : <p role={note.kind}>{note.text}</p>}
    </form>
  );
}
