# milestone-collectible@1

The one-off item a claim creates. It stores its issuing game, milestone and edition number, and builds its
picture when read from the drawing the game keeps once per milestone. ABI:
`../abi/milestone-collectible@1.json` (Orbital opcodes 99 to 101 and 1000 to 1002).

- **Modules:** `state` (storage keys), `views`; `lib.rs` initialises the item.
- **Dependencies:** `rewards-core` (picture, attributes, drawing check), `responder-kit`.
- **Configuration:** none.
- **Limit:** anyone can create an instance of this template; a collectible is genuine only if its issuer
  (`get-attributes`) is a game the platform lists. See `../README.md`.
- **Tests:** `../harness/tests/collectible.rs`.
- **Owner:** contract engineering.
