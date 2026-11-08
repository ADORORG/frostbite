import { defineShareConfig } from "@frostbite/share";

// Where a player can send a link to something they earned, in the order the menu shows them. A destination's address is the one it
// documents for opening a post that is ready to send; `{text}`, `{url}` and `{textAndUrl}` are filled in, percent-encoded. A change
// here is a reviewed change, and a wrong template stops the platform at start (`defineShareConfig`).
export const shareConfig = defineShareConfig({
  // None until the brand decides on one: a tag nobody chose is not ours to add to a post.
  hashtags: [],
  platforms: [
    {
      id: "x",
      label: "X",
      // The large microblog's limit, which counts every link as a fixed length.
      maxTextLength: 280,
      template: "https://x.com/intent/post?text={text}&url={url}",
    },
    {
      id: "facebook",
      label: "Facebook",
      template: "https://www.facebook.com/sharer/sharer.php?u={url}",
    },
    {
      id: "reddit",
      label: "Reddit",
      template: "https://www.reddit.com/submit?url={url}&title={text}",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      template: "https://www.linkedin.com/sharing/share-offsite/?url={url}",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      template: "https://wa.me/?text={textAndUrl}",
    },
    {
      id: "telegram",
      label: "Telegram",
      template: "https://t.me/share/url?url={url}&text={text}",
    },
  ],
});
