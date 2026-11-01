// What the guild's chapter says, by the id of the message the rules give (`state.message`), and the names of the shows and the hints that
// give away each keeper's favourite. Written in capitals, as the screen's type is.
export const castleWords: Readonly<Record<string, string>> = {
  boulder: "TOO HEAVY. A STRONG FRIEND COULD PUSH IT!",
  bramble: "THICK BRAMBLES. A PLANT FRIEND COULD ASK THEM TO MOVE!",
  captured: "THE CASTLE IS YOURS! HOORAY FOR THE GUILD!",
  "challenge-0": "A GRUMBLE GUARD BLOCKS THE GATE! CHEER IT UP!",
  "challenge-1": "ANOTHER GRUMBLE GUARD! PUT ON A SHOW!",
  "challenge-2": "THE TOWER DOOR GUARD LOOKS EXTRA GRUMPY!",
  "challenge-3": "THE GRUMBLE KING! GIVE IT YOUR BEST SHOW!",
  "cheered-0": "THE GUARD CHEERED UP AND STEPPED ASIDE!",
  "cheered-1": "ANOTHER SMILE! THE HALL IS OPEN!",
  "cheered-2": "THE TOWER GUARD IS GIGGLING! GO ON UP!",
  "cheered-3": "THE KING IS SMILING! RAISE YOUR BANNER!",
  "got-0": "A POT OF HONEY!",
  "got-1": "A SHINY SHELL!",
  "got-2": "A BAG OF FLOWER SEEDS!",
  "got-3": "A JAR OF FIREFLIES!",
  "charm-0": "SPIRIT CHARM! THE GUILD FEELS BRAND NEW!",
  "charm-1": "STAR CHARM! THE NEXT SHOW SHINES THREE TIMES AS BRIGHT!",
  "charm-2": "SHIELD CHARM! THE NEXT TWO GRUMBLES WILL BOUNCE OFF!",
  "found-charm-0": "A SECRET SPIRIT CHARM! PRESS C IN A CHALLENGE TO USE IT.",
  "found-charm-1": "A SECRET STAR CHARM! PRESS C IN A CHALLENGE TO USE IT.",
  "found-charm-2": "A SECRET SHIELD CHARM! PRESS C IN A CHALLENGE TO USE IT.",
  ice: "FROZEN SOLID. TRY BREATHING FIRE WITH F!",
  "joined-0": "BOLT JOINED THE GUILD! BUMP A BOULDER TO PUSH IT.",
  "joined-1": "SPLASH JOINED! BUMP THE FORD TO GROW LILY PADS.",
  "joined-2": "BLOOM JOINED! BUMP BRAMBLES AND THEY WILL PART.",
  "joined-3": "SPARK JOINED! THE GUILD IS COMPLETE!",
  lilies: "SPLASH GREW LILY PADS ACROSS THE FORD!",
  melted: "YOUR FIRE MELTED THE ICE!",
  nap: "YOUR GUILD TOOK A NAP AND WOKE UP REFRESHED. KEEP GOING!",
  "not-yet": "THAT FRIEND HAS NOT JOINED YOUR GUILD YET!",
  parted: "BLOOM ASKED THE BRAMBLES TO PART!",
  pushed: "BOLT PUSHED THE BOULDER OUT OF THE WAY!",
  river: "TOO DEEP TO CROSS. A WATER FRIEND COULD HELP!",
  tired: "THAT SHOW IS TOO TIRED. PICK ANOTHER!",
  "wants-0": "BOLT: I'M TOO HUNGRY TO PUSH ROCKS. FIND ME SOME HONEY?",
  "wants-1": "SPLASH: I LOST MY SHINY SHELL ON THE BEACH!",
  "wants-2": "BLOOM: MY SEEDS ARE FROZEN IN THE ICE GARDEN!",
  "wants-3": "SPARK: FIND MY FIREFLY JAR AND I'LL LIGHT UP ANY SHOW!",
};

export const showNames = [
  "FIREWORKS",
  "SILLY DANCE",
  "BUBBLE SHOW",
  "FLOWER CROWN",
  "LIGHT SHOW",
] as const;

export const hints = [
  "IT LOVES LOUD, SPARKLY THINGS.",
  "ITS FOOT IS TAPPING TO A BEAT.",
  "IT LOOKS HOT AND STUFFY.",
  "IT KEEPS SNIFFING THE AIR.",
  "IT SEEMS SCARED OF THE DARK.",
] as const;

export const keeperNames = [
  "GATE GUARD",
  "HALL GUARD",
  "TOWER GUARD",
  "GRUMBLE KING",
] as const;

// Every move in a challenge, by its number (`moves`, then quick cheer, evade, charm), and its hotkey.
export const moveNames = [
  ...showNames,
  "QUICK CHEER",
  "EVADE",
  "CHARM",
] as const;
export const moveKeys = ["1", "2", "3", "4", "5", "Q", "E", "C"] as const;

// Each keeper's three grumble attacks.
export const attackNames = [
  ["GRUMPY GLARE", "HUFF AND PUFF", "STOMP OF SULKS"],
  ["SIGH STORM", "ECHO GRUMBLE", "ARMS FOLDED"],
  ["TOWER TANTRUM", "COLD SHOULDER", "SULKY SHADOW"],
  ["ROYAL GRUMBLE", "THRONE THUMP", "CROWN FROWN"],
] as const;
