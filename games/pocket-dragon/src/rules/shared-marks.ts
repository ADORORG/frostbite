// The marks every chapter can earn, by the same id: the first secret charm found, and a great deal of metaplasma gathered in one run.
// The manifest lists each once; whichever chapter's run earns it first is the one that claims it.
export const charmMark = "secret-charm";
export const plasmaMark = "metaplasma-300";
export const plasmaGoal = 300;

export const sharedMarks = <State>(
  charms: (state: State) => number,
  plasma: (state: State) => number,
): readonly (readonly [string, (state: State) => boolean])[] => [
  [charmMark, (state) => charms(state) >= 1],
  [plasmaMark, (state) => plasma(state) >= plasmaGoal],
];
