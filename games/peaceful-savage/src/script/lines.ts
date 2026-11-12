import type { ChoiceId, MomentKind } from "../rules/moments.ts";
import { creationWords } from "./creations.ts";

// Every word the story says, once: the moments' titles, what each step asks of the player, the two things on offer at each choice, and
// the clues and relics. The sly snakes are ancestors with feelings nobody listened to; what they whisper is a trick, and the true answer
// heals them. The words are a draft for the owner.

export const momentTitles: Readonly<Record<MomentKind, string>> = {
  ali: "Daddy in the fog",
  build: "Kai's tower, step by step",
  drawer: "Daddy's locked drawer",
  finale: "The giant sly snake",
  forge: "The lamp that would not go out",
  grey: "A sly snake whispers",
  heerah: "Mama by the tree",
  hologram: creationWords.hologram.title,
  masterpiece: creationWords.masterpiece.title,
  kai: "Kai's cracked tower",
  mirror: "At the mirror",
  practice: "Practice",
  release: creationWords.release.title,
  song: creationWords.song.title,
  weave: "Weaving the jackets",
  zora: "Zora's silly cube",
};

// A choice: who speaks, what they say, and the two answers (the order they are offered in is the seed's).
export interface Choice {
  readonly said: string;
  readonly trick: string;
  readonly truth: string;
  readonly who: string;
}

const snake = "A sly snake";

export const choices: Readonly<Record<ChoiceId, Choice>> = {
  ali: {
    said: "I'm fine. I've got it handled. Go and play.",
    trick: "Okay, Daddy. You've got it.",
    truth: "You don't have to carry it alone, Daddy. You're safe with us.",
    who: "Daddy",
  },
  "grey-0": {
    said: "Shh. Big feelings are too much. Hide them away.",
    trick: "Okay. I'll hide it.",
    truth: "Big feelings are allowed. I can feel this and still be okay.",
    who: snake,
  },
  "grey-1": {
    said: "It's your fault the house went grey.",
    trick: "It is my fault.",
    truth: "It isn't mine to carry. I can still help bring the light back.",
    who: snake,
  },
  "grey-2": {
    said: "Everyone's better than you. Why even try?",
    trick: "Why bother trying.",
    truth: "I don't need to be better than anyone. I'm enough as me.",
    who: snake,
  },
  "grey-3": {
    said: "Shout it! Make them feel it too!",
    trick: "Yeah! Let them have it!",
    truth: "I'm angry. I'll breathe first, then say it kindly.",
    who: snake,
  },
  "grey-4": {
    said: "Nobody will help you. Do it all alone.",
    trick: "Fine. I'll do it alone.",
    truth: "I can ask for help. My family is right here.",
    who: snake,
  },
  "grey-5": {
    said: "Smile and say you're fine, then nobody will ask.",
    trick: "I'm fine. I'm always fine.",
    truth: "I don't have to pretend. I can say how I really am.",
    who: snake,
  },
  heerah: {
    said: "I keep everyone together. I don't even know what I need.",
    trick: "Keep going, Mama. We need you.",
    truth: "Breathe, Mama. Tell us what you need, and we'll listen.",
    who: "Mama",
  },
  kai: {
    said: "It's just a dumb tower. I don't even care.",
    trick: "Cool. Let's go then.",
    truth: "It's okay to care. Let's breathe, then build it again together.",
    who: "Kai",
  },
  "serpent-ask": {
    said: "Go away! Nobody ever listened to us!",
    trick: "Then go away!",
    truth: "We're listening now. Come closer.",
    who: "The giant sly snake",
  },
  "serpent-feel": {
    said: "And what do you feel, now that you have heard us?",
    trick: "Nothing. We feel nothing.",
    truth: "We feel sad for all you carried, and we love you.",
    who: "The giant sly snake",
  },
  zora: {
    said: "Nobody can get into my cube. I like it in here alone.",
    trick: "Fine. Stay in there.",
    truth: "Can I come in? Then let's go and plant something together.",
    who: "Zora",
  },
};

// What each step asks for. The act key is named by the page (a key on a keyboard, a tap on a touch screen).
export const stepWords = {
  beat: "on the beat: act as the ring closes",
  breathHold: "In, two, three, four... now let go.",
  breathIn: "Hold act and breathe in for four counts.",
  breathOut: "And out, slowly, for six counts.",
  centre: "Act to look into the mirror and come back to you.",
  choose: "What do you say?",
  huddle: "Act to gather close, arms round each other.",
  lean: "Act to sit down beside them.",
} as const;

// A clue in each room (hall, kitchen, children's room, office, parents' room, meadow): something the house wants you to know.
export const clueLines: readonly string[] = [
  "The tree remembers every name. Touch it when you need the way.",
  "A sly snake heals only when you answer it true.",
  "Hold the act key while you breathe in for four, then let go for six.",
  "Daddy keeps a drawer locked. Bring him home before you knock on it.",
  "Six threads, one loom: Mama weaves the jackets.",
  "Something sleeps on the hill. Go there in your jackets, all four of you together.",
];

// The relics, one in each room: inventors whose work is still in every home.
export const relicLines: readonly string[] = [
  "Benjamin Banneker carved a wooden clock by hand that kept time for decades.",
  "Elijah McCoy invented a cup that oiled steam engines while they ran.",
  "Frederick McKinley Jones invented a cooler that kept food fresh on long truck rides.",
  "Granville Woods invented a telegraph that let moving trains talk to stations.",
  "Madam C. J. Walker built a hair care business and became one of America's first self-made women millionaires.",
  "Garrett Morgan invented a traffic signal with a warning step between stop and go.",
];
