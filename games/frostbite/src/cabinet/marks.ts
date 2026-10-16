// The game names its milestones in camel case (`firstWin`) and the platform in slugs (`first-win`); the bridge turns
// the first into the second, so the cabinet reports by the first.
export const markOf = (milestone: string): string =>
  milestone.replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
