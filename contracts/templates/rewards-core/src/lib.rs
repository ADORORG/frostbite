//! Rules and pictures shared by the `game-rewards` and `milestone-collectible` contracts.
//!
//! Nothing here touches the Alkanes runtime, so every rule runs and is covered natively. The
//! contracts are thin: they read the transaction and storage, call these functions, and write the
//! answer back.

pub mod art;
pub mod attributes;
pub mod holder;
pub mod key;
pub mod opcode;
pub mod policy;
pub mod render;
