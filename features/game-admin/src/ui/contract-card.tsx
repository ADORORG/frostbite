import {
  ArcadeActionButton,
  ArcadeInfoCard,
  ArcadeTextField,
} from "@repo/ui/arcade";
import { gameAdminPath } from "@ador/shared/games";
import { useState } from "react";

// A game with no contract yet: why not, and, once both templates are published, the one step that makes it. A contract's address
// is fixed when it is created, and so is the largest drawing it will keep.
export function ContractCard({
  busy,
  drawingCeiling,
  onCreate,
  templatesReady,
}: {
  readonly busy: boolean;
  // The most a contract may be created to accept; offered as the size, since it cannot be raised afterwards.
  readonly drawingCeiling: number;
  readonly onCreate: (maxDrawingBytes: number) => void;
  readonly templatesReady: boolean;
}) {
  const [size, setSize] = useState(String(drawingCeiling));
  const bytes = Number(size);
  const valid = Number.isInteger(bytes) && bytes > 0 && bytes <= drawingCeiling;
  return (
    <ArcadeInfoCard title="Rewards contract">
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
          <ArcadeActionButton
            disabled={busy || !valid}
            onClick={() => onCreate(bytes)}
            tone="mint"
          >
            Create the contract
          </ArcadeActionButton>
        </>
      ) : (
        <p>
          The templates a contract is made from are not both published yet.{" "}
          <a href={gameAdminPath}>Publish them first.</a>
        </p>
      )}
    </ArcadeInfoCard>
  );
}
