# Media test fixtures

Real encoder output used to prove the structural parsers accept legitimate files (the builders in
`test/support/builders.ts` only produce what the parsers' authors expected). All files are tiny
7x5 images generated with Pillow 10.2.0 (libwebp/libjpeg/zlib): `real-rgb.png`, `real-rgba.png`,
`real-baseline.jpg` (quality 80), `real-progressive.jpg`, `real-lossy.webp` (VP8),
`real-lossless.webp` (VP8L), `real-alpha.webp` (VP8X + VP8L), `real-alpha-lossy.webp`
(VP8X + ALPH + VP8), and the animated negatives `real-animated.png` (APNG) and
`real-animated.webp` (VP8X + ANIM/ANMF). They are fixtures/data, exempt from the source line limit.
