import { gameAdminPath } from "@frostbite/shared/games";
import {
  ArcadeActionButton,
  ArcadeTextField,
  KeyValueList,
  SectionBlock,
} from "@repo/ui/arcade";
import { useState } from "react";

// A game's rewards contract: its address and what it keeps, once it exists; before, why not, and, once both templates are published,
// the one step that makes it. A contract's address is fixed when it is created, and so is the largest drawing it will keep.
export function ContractSection({
  address,
  busy,
  drawingCeiling,
  maxDrawingBytes,
  onCreate,
  preparing,
  templatesReady,
}: {
  // Where the contract is, once it has been made.
  readonly address: string | null;
  readonly busy: boolean;
  // The most a contract may be created to accept; offered as the size, since it cannot be raised afterwards.
  readonly drawingCeiling: number;
  // What the contract that exists keeps.
  readonly maxDrawingBytes: number | null;
  readonly onCreate: (maxDrawingBytes: number) => void;
  // The creation is being prepared.
  readonly preparing: boolean;
  readonly templatesReady: boolean;
}) {
  const [size, setSize] = useState(String(drawingCeiling));
  const bytes = Number(size);
  const valid = Number.isInteger(bytes) && bytes > 0 && bytes <= drawingCeiling;
  if (address !== null)
    return (
      <SectionBlock title="Rewards contract">
        <KeyValueList
          items={[
            {
              label: "Address",
              mono: true,
              value: <span data-testid="contract-address">{address}</span>,
            },
            {
              label: "Keeps drawings up to",
              value:
                maxDrawingBytes === null
                  ? undefined
                  : `${maxDrawingBytes} bytes`,
            },
          ]}
        />
      </SectionBlock>
    );
  return (
    <SectionBlock
      description="Made once from the published templates. Its address is fixed when it is made, and so is the largest drawing it will keep."
      title="Rewards contract"
    >
      <p>
        This game has no rewards contract yet, so there is nothing to
        administer.
      </p>
      {templatesReady ? (
        <>
          <ArcadeTextField
            hint={`The largest milestone drawing the contract will keep, in bytes (at most ${drawingCeiling}). It cannot be changed afterwards.`}
            label="Largest drawing (bytes)"
            onChange={setSize}
            value={size}
          />
          <div>
            <ArcadeActionButton
              busy={preparing}
              disabled={busy || !valid}
              onClick={() => onCreate(bytes)}
              tone="mint"
            >
              {preparing ? "Preparing…" : "Create the contract"}
            </ArcadeActionButton>
          </div>
        </>
      ) : (
        <p>
          The templates a contract is made from are not both published yet.{" "}
          <a href={gameAdminPath}>Publish them first.</a>
        </p>
      )}
    </SectionBlock>
  );
}
