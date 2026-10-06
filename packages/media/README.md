# `@ador/media`

Pure structural validation of PNG, JPEG, and WebP bytes with no third-party dependencies
(ADR-004, D07, W3-04). It depends only on the shared contract types in `@ador/shared`.

## Public API

`validateImage({ bytes, declaredMediaType, limits })` returns either geometry, byte length and a
SHA-256, or a stable `AssetRejectionReason`. `mediaValidatorVersion` names this parser generation
(`structural-v1`) and is stored with every outcome. The package imports no storage, database, or
framework code and performs no I/O.

## What is and is not validated

- The leading bytes decide the format; the declared type must then match (`media-type-mismatch`).
- PNG: every chunk and CRC, one IHDR first, IDAT present, one IEND, no trailing bytes, no APNG.
- JPEG: every marker segment, one baseline/extended/progressive Huffman frame, at least one scan,
  a final EOI, no trailing bytes. Lossless, arithmetic, and hierarchical frames are unsupported.
- WebP: RIFF size equals the file length and chunks tile it exactly; one VP8/VP8L image; an
  extended canvas must equal the coded image; animation is rejected.
- Width, height, and pixel count are checked against the typed limits, but only after the
  container is proven well formed. The limits apply to the dimensions the container _declares_: a
  header that lies about its pixel stream is still a well-formed container and is not detected
  here. The W3-05 decoder must reject any stream whose decoded size differs from the recorded size
  and enforce its own pixel limit while decoding.
- **Not validated:** the compressed pixel stream. A file can be a well-formed container whose
  pixels fail to decode. That is detected by the vetted decoder introduced with W3-05 thumbnails,
  which must treat a decode failure as a terminal rejection. Metadata (EXIF, ICC, XMP) is
  neither trusted nor stripped here; derivatives strip it.
- Bytes are fully buffered, bounded by the caller: the uploads activity caps each read at the
  declared size, itself capped by upload policy (at most 25 MB today). That bound is per run;
  nothing here limits concurrent runs, so the trigger that invokes the activity must.

## Processing port

`@ador/media/processing` defines `ImageProcessor` and its typed `media-processing:image-derivatives`
capability. It is the boundary between platform code and a decoder; the `sharp` implementation is the
provider adapter `@ador/provider-media-processing-sharp` (ADR-013). This package stays decoder-free.

## Invariants

Parsers are written to return a rejection rather than throw: every length is checked against the
buffer before it is used, and a seeded fuzz test (about 18,000 mutated and random inputs per run)
fails on any thrown error. Every rejection maps to one reason code. Limits and the reason
vocabulary come from `@ador/shared/uploads`; nothing is configured here.

## Tests

`test:unit` covers each parser with real encoder output (`test/fixtures`, see its README),
every-prefix truncation of each format, every-byte corruption of a PNG, and boundary limits.
`test:integration` feeds adversarial files (bomb headers, polyglots, spoofed types, out-of-scope formats) through the public
API under the real default policy. Platform engineering owns this package.
