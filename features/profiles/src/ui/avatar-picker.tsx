"use client";

import { ProfileAvatar, avatarAccent } from "@repo/ui/arcade";
import {
  profileAvatarIds,
  type ProfileAvatarId,
} from "@frostbite/shared/profiles";

import { profileCopy } from "../domain/copy.ts";
import type { StyleWithVars } from "./css-vars.ts";

// The twelve fighters, as a group of radios: a keyboard moves through them with the arrow keys, a screen reader hears each by name, and the
// tiles are big enough for a thumb. The chosen one is lit in its own colour.
export function AvatarPicker({
  onChange,
  value,
}: {
  readonly onChange: (avatar: ProfileAvatarId) => void;
  readonly value: ProfileAvatarId;
}) {
  return (
    <fieldset className="avatar-picker">
      <legend className="arcade-visually-hidden">
        {profileCopy.setup.avatar.legend}
      </legend>
      {profileAvatarIds.map((id) => {
        const style: StyleWithVars = { "--tile-accent": avatarAccent(id) };
        return (
          <label className="avatar-picker__tile" key={id} style={style}>
            <input
              aria-label={id}
              checked={value === id}
              name="avatar"
              onChange={() => onChange(id)}
              type="radio"
              value={id}
            />
            <ProfileAvatar avatar={id} size={72} />
          </label>
        );
      })}
    </fieldset>
  );
}
