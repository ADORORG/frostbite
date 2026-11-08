import { defineShareConfig } from "../src/config.ts";

// Destinations as a deployment would configure them.
export const config = defineShareConfig({
  hashtags: ["Frostbite"],
  platforms: [
    {
      accent: "#000000",
      id: "x",
      label: "X",
      mark: "X",
      maxTextLength: 280,
      template: "https://x.example/post?text={text}&url={url}",
    },
    {
      accent: "#25d366",
      id: "chat",
      label: "Chat",
      mark: "ch",
      template: "https://chat.example/send?text={textAndUrl}",
    },
  ],
});
