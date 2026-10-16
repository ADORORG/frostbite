//! The collectible's picture: the builder's drawing inside a generated frame with an edition
//! plate, or a generated sprite when the milestone has no drawing.

pub mod frame;
pub mod sprite;
pub mod text;

/// What `get-content-type` answers for the picture `frame::picture` builds.
pub const CONTENT_TYPE: &str = "image/svg+xml";
