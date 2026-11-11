import {
  avatarSpriteIds,
  avatarSprites,
  spriteRows,
  type AvatarSpriteId,
} from "./avatar-sprites.ts";

export { avatarSpriteIds, type AvatarSpriteId };

// The colour a preset picture's frame and glow take on, or the platform's cyan for an id that is not a preset.
export const avatarAccent = (id: string): string =>
  isSpriteId(id) ? avatarSprites[id].accent : "#2be7ff";

function isSpriteId(id: string): id is AvatarSpriteId {
  return id in avatarSprites;
}

// A profile's preset picture, drawn as crisp pixels from the sprite's own data: no image, request or upload. `label` makes it a named
// picture for assistive technology; without one it is decoration (a name stands next to it). An id that is not a preset draws nothing.
export function ProfileAvatar({
  avatar,
  label,
  size = 96,
}: {
  readonly avatar: string;
  readonly label?: string;
  readonly size?: number;
}) {
  if (!isSpriteId(avatar)) return null;
  const sprite = avatarSprites[avatar];
  const colours: Readonly<Record<string, string>> = sprite.colours;
  return (
    <svg
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      className="profile-avatar"
      height={size}
      role={label === undefined ? undefined : "img"}
      shapeRendering="crispEdges"
      viewBox="0 0 10 10"
      width={size}
    >
      {spriteRows(sprite).flatMap((row, y) =>
        [...row].map((letter, x) => {
          const fill = colours[letter];
          return fill === undefined ? null : (
            <rect
              fill={fill}
              height="1"
              key={`${String(x)}-${String(y)}`}
              width="1"
              x={x}
              y={y}
            />
          );
        }),
      )}
    </svg>
  );
}
