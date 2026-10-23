"use client";

import { useId, type ReactNode } from "react";

export interface ChoiceOption<Value extends string> {
  readonly disabled?: boolean;
  // A short line under the label that is not the label (a wait, a size).
  readonly detail?: ReactNode;
  // Why the choice is off, or what it is, in a few words; it is read with the label.
  readonly hint?: string;
  readonly label: string;
  // The figure that tells the choices apart (a price, a rate).
  readonly meta?: ReactNode;
  readonly value: Value;
}

function Face<Value extends string>({
  option,
}: {
  readonly option: ChoiceOption<Value>;
}) {
  return (
    <>
      <span className="segmented__label">{option.label}</span>
      {option.meta === undefined ? null : (
        <span className="segmented__meta">{option.meta}</span>
      )}
      {option.detail === undefined ? null : (
        <span className="segmented__detail">{option.detail}</span>
      )}
      {option.hint === undefined ? null : (
        <small className="segmented__hint">{option.hint}</small>
      )}
    </>
  );
}

// The same tiles to be read, not chosen: the choices and their figures laid out as they are where one is made, so a reader sees one
// thing in both places.
export function ChoiceTiles<Value extends string>({
  label,
  options,
}: {
  readonly label: string;
  readonly options: readonly ChoiceOption<Value>[];
}) {
  return (
    <ul
      aria-label={label}
      className="segmented__options segmented__options--static"
    >
      {options.map((option) => (
        <li
          className="segmented__option"
          data-off={option.disabled === true ? "true" : undefined}
          key={option.value}
        >
          <Face option={option} />
        </li>
      ))}
    </ul>
  );
}

// A few choices side by side as tiles, one of which is chosen: for picking one of a small set where the differences are worth seeing
// together (how fast to confirm). Real radio buttons underneath, so the keyboard and screen readers work as for any group. A choice
// that is off cannot be picked by any route.
export function SegmentedChoice<Value extends string>({
  disabled = false,
  legend,
  onChange,
  options,
  value,
}: {
  readonly disabled?: boolean;
  readonly legend: string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly ChoiceOption<Value>[];
  readonly value: Value;
}) {
  const group = useId();
  return (
    <fieldset className="segmented" disabled={disabled}>
      <legend>{legend}</legend>
      <div className="segmented__options">
        {options.map((option) => (
          <label
            className="segmented__option"
            data-off={option.disabled === true ? "true" : undefined}
            key={option.value}
          >
            <input
              checked={value === option.value}
              disabled={option.disabled}
              name={group}
              onChange={() => {
                if (option.disabled !== true) onChange(option.value);
              }}
              type="radio"
              value={option.value}
            />
            <Face option={option} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
