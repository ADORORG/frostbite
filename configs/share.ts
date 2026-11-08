import { defineShareConfig } from "@frostbite/share";

// Where a player can send a link to something they earned, in the order the menu shows them. A destination's address is the one it
// documents for opening a post that is ready to send; `{text}`, `{url}` and `{textAndUrl}` are filled in, percent-encoded. A change
// here is a reviewed change, and a wrong template stops the platform at start (`defineShareConfig`).
export const shareConfig = defineShareConfig({
  // None until the brand decides on one: a tag nobody chose is not ours to add to a post.
  hashtags: [],
  platforms: [
    {
      accent: "#000000",
      id: "x",
      mark: "X",
      label: "X",
      // The large microblog's limit, which counts every link as a fixed length.
      maxTextLength: 280,
      template: "https://x.com/intent/post?text={text}&url={url}",
    },
    {
      accent: "#1877f2",
      id: "facebook",
      mark: "f",
      label: "Facebook",
      template: "https://www.facebook.com/sharer/sharer.php?u={url}",
    },
    {
      accent: "#ff4500",
      id: "reddit",
      mark: "re",
      label: "Reddit",
      template: "https://www.reddit.com/submit?url={url}&title={text}",
    },
    {
      accent: "#0a66c2",
      id: "linkedin",
      mark: "in",
      label: "LinkedIn",
      template: "https://www.linkedin.com/sharing/share-offsite/?url={url}",
    },
    {
      accent: "#25d366",
      id: "whatsapp",
      mark: "wa",
      label: "WhatsApp",
      template: "https://wa.me/?text={textAndUrl}",
    },
    {
      accent: "#26a5e4",
      id: "telegram",
      mark: "tg",
      label: "Telegram",
      template: "https://t.me/share/url?url={url}&text={text}",
    },
  ],
});
