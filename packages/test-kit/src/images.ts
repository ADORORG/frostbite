// Tiny, real, fully decodable 24x16 images for the other two committed formats (see `png.ts` for PNG).
// They are fixture data produced once with the repository's pinned `sharp` from the same colour
// gradient (JPEG quality 80; lossless WebP), stored as base64 so tests need no image library.
const jpegBase64 =
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAQABgDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgAH/8QAGRAAAgMBAAAAAAAAAAAAAAAAAAQGIjGh/8QAFgEBAQEAAAAAAAAAAAAAAAAABQYH/8QAHhEAAQMEAwAAAAAAAAAAAAAAAAQFBgEDITEiI2H/2gAMAwEAAhEDEQA/AMkRj+UECMfyg+Rj+UECMfynCiUvXoKyyHWQAjH8pwjXkY/lOEC3Hrls09HIeumT/9k=";
const webpBase64 =
  "UklGRi4AAABXRUJQVlA4TCIAAAAvF8ADALkyRPQ/dhHR/wCRtk0d3L/jwcNRGNCYAKoeqP8E";

export const imageFixtureSize = { height: 16, width: 24 } as const;

export const createJpeg = (): Buffer => Buffer.from(jpegBase64, "base64");
export const createWebp = (): Buffer => Buffer.from(webpBase64, "base64");
