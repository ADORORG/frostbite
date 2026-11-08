import { defineShareConfig } from "../src/config.ts";

// Destinations as a deployment would configure them.
export const config = defineShareConfig({
  hashtags: ["Frostbite"],
  platforms: [
    {
      id: "x",
      label: "X",
      maxTextLength: 280,
      template: "https://x.example/post?text={text}&url={url}",
    },
    {
      id: "chat",
      label: "Chat",
      template: "https://chat.example/send?text={textAndUrl}",
    },
  ],
});
