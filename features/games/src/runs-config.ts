// Where the platform finds each game's built verifier: a folder per game id under this directory, holding `verifier.js`. It
// is the folder the games are built into and served from, so the file checked is the file the manifest pins.
export interface GameRunsConfig {
  readonly playRoot: string;
}
