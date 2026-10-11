// The public game pages. One source for the manifest, the page registration, navigation and browser tests.
export const gamesPath = "/games";
export const gamePagePath = "/games/[slug]";
export const gamesNavigationLabel = "Games";

export const gameHref = (id: string) => `${gamesPath}/${id}`;
