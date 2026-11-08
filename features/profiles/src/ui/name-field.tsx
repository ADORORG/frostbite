"use client";

import { ArcadeTextField } from "@repo/ui/arcade";

import { profileCopy } from "../domain/copy.ts";
import type { NameStatusView } from "../domain/name-status.ts";

// The name, with what the platform says about it while the player types: a problem under the field, or a status line (free, checking, yours),
// and a counter. The words come from the profile catalogue; the bounds come from the server.
export function NameField({
  bounds,
  disabled,
  onChange,
  status,
  value,
}: {
  readonly bounds: { readonly maxLength: number; readonly minLength: number };
  readonly disabled: boolean;
  readonly onChange: (name: string) => void;
  readonly status: NameStatusView;
  readonly value: string;
}) {
  return (
    <div className="name-field">
      <ArcadeTextField
        autoComplete="nickname"
        disabled={disabled}
        error={status.error}
        hint={profileCopy.setup.name.hint(bounds.minLength, bounds.maxLength)}
        label={profileCopy.setup.name.label}
        maxLength={bounds.maxLength + 8}
        onChange={onChange}
        value={value}
      />
      <div className="name-field__row">
        <p
          aria-live="polite"
          className="name-status"
          data-tone={status.note?.tone}
          hidden={status.note === null}
          role="status"
        >
          {status.note?.text}
        </p>
        <span aria-hidden="true" className="name-field__count">
          {profileCopy.setup.name.count(value.length, bounds.maxLength)}
        </span>
      </div>
    </div>
  );
}
