//! A builder's drawing as the contract accepts it. The platform sanitises a drawing before it is
//! submitted; this is the second line of defence, so a drawing that slips through still cannot
//! close its frame early or carry active content.

use crate::policy::Refusal;

/// Lower-case fragments that never belong in a milestone drawing.
const FORBIDDEN: [&str; 6] = [
    "<script",
    "<foreignobject",
    "<iframe",
    "javascript:",
    "<!entity",
    "<!doctype",
];

/// The drawing as text, or the reason it is refused. `None` or empty means "no drawing", which
/// the collectible shows as the fallback sprite.
pub fn validate(bytes: &[u8], max: usize) -> Result<Option<&str>, Refusal> {
    if bytes.is_empty() {
        return Ok(None);
    }
    if bytes.len() > max {
        return Err(Refusal::ArtTooLarge);
    }
    let text = std::str::from_utf8(bytes).map_err(|_| Refusal::ArtNotSvg)?;
    let lower = text.to_ascii_lowercase();
    let single_document = lower.starts_with("<svg")
        && lower.ends_with("</svg>")
        && lower.matches("<svg").count() == 1
        && lower.matches("</svg>").count() == 1;
    if !single_document {
        return Err(Refusal::ArtNotSvg);
    }
    if FORBIDDEN.iter().any(|fragment| lower.contains(fragment)) {
        return Err(Refusal::ArtForbidden);
    }
    Ok(Some(text))
}

#[cfg(test)]
mod tests {
    use super::*;

    const GOOD: &str = "<svg viewBox=\"0 0 10 10\"><circle r=\"4\"/></svg>";

    #[test]
    fn a_plain_drawing_is_accepted() {
        assert_eq!(validate(GOOD.as_bytes(), 4096), Ok(Some(GOOD)));
    }

    #[test]
    fn the_shared_drawing_vectors_agree() {
        let file: serde_json::Value =
            serde_json::from_str(include_str!("../../abi/drawing-vectors.json")).expect("JSON");
        for good in file["canonical"].as_array().expect("canonical") {
            let text = good.as_str().expect("text");
            assert_eq!(validate(text.as_bytes(), 4096), Ok(Some(text)), "{text}");
        }
        for bad in file["contractRefuses"].as_array().expect("refused") {
            let text = bad.as_str().expect("text");
            assert!(validate(text.as_bytes(), 4096).is_err(), "{text}");
        }
    }

    #[test]
    fn nothing_means_no_drawing() {
        assert_eq!(validate(b"", 4096), Ok(None));
    }

    #[test]
    fn the_limit_is_inclusive() {
        assert_eq!(validate(GOOD.as_bytes(), GOOD.len()), Ok(Some(GOOD)));
        assert_eq!(
            validate(GOOD.as_bytes(), GOOD.len() - 1),
            Err(Refusal::ArtTooLarge)
        );
    }

    #[test]
    fn bytes_that_are_not_text_are_refused() {
        assert_eq!(validate(&[0xff, 0xfe], 10), Err(Refusal::ArtNotSvg));
    }

    #[test]
    fn something_that_is_not_one_svg_is_refused() {
        for bad in [
            "hello",
            "<svg></svg><svg></svg>",
            "<svg></svg><g/>",
            "<g/><svg></svg>",
            "<svg><svg></svg></svg>",
            "<svg><svg></svg>",
        ] {
            assert_eq!(
                validate(bad.as_bytes(), 4096),
                Err(Refusal::ArtNotSvg),
                "{bad}"
            );
        }
    }

    #[test]
    fn active_content_is_refused_in_any_case() {
        for bad in [
            "<svg><script>x</script></svg>",
            "<svg><SCRIPT>x</SCRIPT></svg>",
            "<svg><foreignObject/></svg>",
            "<svg><iframe/></svg>",
            "<svg><a href=\"JavaScript:alert(1)\"/></svg>",
            "<svg><!ENTITY x></svg>",
            "<svg><!DOCTYPE x></svg>",
        ] {
            assert_eq!(
                validate(bad.as_bytes(), 4096),
                Err(Refusal::ArtForbidden),
                "{bad}"
            );
        }
    }
}
