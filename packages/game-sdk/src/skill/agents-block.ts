// The part of a project's AGENTS.md that points an agent at the skill. It sits between two markers so `update` can replace it without
// touching what the project wrote around it, and `doctor` can tell whether it is there.
export const blockStart = "<!-- build-a-game:start -->";
export const blockEnd = "<!-- build-a-game:end -->";

export interface BlockInput {
  // The SDK's package name, read from its package.json, so the text is right whatever the platform is called.
  readonly sdk: string;
  // Where the skill's SKILL.md was installed, relative to the project.
  readonly skillPath: string;
}

export function skillBlock({ sdk, skillPath }: BlockInput): string {
  return [
    blockStart,
    "## Building a game for the platform",
    "",
    `This project builds games on the \`${sdk}\` SDK. Before making or changing a game, read \`${skillPath}\` and follow it.`,
    blockEnd,
  ].join("\n");
}

const markers = new RegExp(`${blockStart}[\\s\\S]*?${blockEnd}`);

// The file's text with the block in it: replaced where it already is, or added at the end.
export function withSkillBlock(text: string, block: string): string {
  if (markers.test(text)) return text.replace(markers, () => block);
  const body = text.trimEnd();
  return body === "" ? `${block}\n` : `${body}\n\n${block}\n`;
}

export const hasSkillBlock = (text: string): boolean => markers.test(text);
