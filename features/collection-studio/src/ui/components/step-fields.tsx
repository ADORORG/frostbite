import type { ChainOption } from "@ador/shared/chain";
import { ArcadeSelect, ArcadeTextField } from "@repo/ui/arcade";
import { collectionLimits } from "@ador/shared/collections";

import type {
  DraftFormErrors,
  DraftFormValues,
} from "../../client/draft-form.ts";

interface StepProps {
  readonly disabled: boolean;
  readonly errors: DraftFormErrors;
  readonly form: DraftFormValues;
  readonly onChange: (changes: Partial<DraftFormValues>) => void;
}

export function DetailsFields({
  disabled,
  errors,
  form,
  only,
  onChange,
}: StepProps & {
  // `name` shows just the name, for starting a draft; otherwise every details field is shown.
  readonly only?: "name";
}) {
  return (
    <div className="arcade-form">
      <ArcadeTextField
        disabled={disabled}
        error={errors.name ?? null}
        label="Collection name"
        maxLength={collectionLimits.name}
        onChange={(name) => onChange({ name })}
        required
        value={form.name}
      />
      {only === "name" ? null : (
        <MoreDetails
          disabled={disabled}
          errors={errors}
          form={form}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function MoreDetails({ disabled, errors, form, onChange }: StepProps) {
  return (
    <>
      <ArcadeTextField
        disabled={disabled}
        error={errors.description ?? null}
        hint="Shown to collectors once the collection is published."
        label="Description"
        maxLength={collectionLimits.description}
        multiline
        onChange={(description) => onChange({ description })}
        value={form.description}
      />
      <ArcadeTextField
        disabled={disabled}
        error={errors.provenance ?? null}
        hint="Who made the work and how it came to be."
        label="Provenance"
        maxLength={collectionLimits.provenance}
        multiline
        onChange={(provenance) => onChange({ provenance })}
        value={form.provenance}
      />
    </>
  );
}

export function SupplyFields({
  chains,
  disabled,
  errors,
  form,
  onChange,
}: StepProps & { readonly chains: readonly ChainOption[] }) {
  return (
    <div className="arcade-form">
      <ArcadeTextField
        disabled={disabled}
        error={errors.plannedSupply ?? null}
        hint="How many items this collection will have. You can change it until you submit."
        label="Planned supply"
        onChange={(plannedSupply) => onChange({ plannedSupply })}
        required
        type="number"
        value={form.plannedSupply}
      />
      <ArcadeSelect
        disabled={disabled}
        label="Target chain"
        onChange={(targetChain) => onChange({ targetChain })}
        options={chainChoices(chains, form.targetChain)}
        value={form.targetChain}
      />
      {errors.targetChain === undefined ? null : (
        <p role="alert">{errors.targetChain}</p>
      )}
    </div>
  );
}

// The enabled chains, plus the draft's own chain if it is no longer offered, so the select never
// silently shows a different chain from the one the draft holds.
function chainChoices(chains: readonly ChainOption[], current: string) {
  const choices = chains.map((chain) => ({
    label: chain.displayName,
    value: chain.chainId,
  }));
  return choices.some(({ value }) => value === current)
    ? choices
    : [
        ...choices,
        { label: `${current} (no longer available)`, value: current },
      ];
}
