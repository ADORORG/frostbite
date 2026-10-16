use super::{sprite, text};

const HEAD: &str = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\"><rect width=\"200\" height=\"200\" fill=\"#12142b\"/><rect x=\"8\" y=\"8\" width=\"184\" height=\"184\" rx=\"12\" fill=\"none\" stroke=\"#7fd8ff\" stroke-width=\"3\"/>";
const ART_OPEN: &str = "<svg x=\"20\" y=\"20\" width=\"160\" height=\"150\">";
const PLATE_OPEN: &str = "<rect x=\"62\" y=\"170\" width=\"76\" height=\"16\" rx=\"8\" fill=\"#000\" fill-opacity=\".45\"/><text x=\"100\" y=\"182\" text-anchor=\"middle\" font-family=\"monospace\" font-size=\"11\" fill=\"#fff\">";
const PLATE_CLOSE: &str = "</text></svg>";

/// The finished picture. `art` is a drawing `art::validate` accepted; without one the milestone
/// gets its sprite. Every collectible of a milestone shares the picture and differs by edition.
pub fn picture(art: Option<&str>, milestone: u128, serial: u128) -> String {
    let mut out = String::with_capacity(art.map_or(2048, |text| text.len() + 700));
    out.push_str(HEAD);
    match art {
        Some(drawing) => {
            out.push_str(ART_OPEN);
            out.push_str(drawing);
            out.push_str("</svg>");
        }
        None => sprite::push(&mut out, milestone),
    }
    out.push_str(PLATE_OPEN);
    text::push_edition(&mut out, serial);
    out.push_str(PLATE_CLOSE);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const DRAWING: &str = "<svg viewBox=\"0 0 10 10\"><circle r=\"4\"/></svg>";

    #[test]
    fn a_drawing_is_framed_and_numbered() {
        let picture = picture(Some(DRAWING), 7, 3);
        assert!(picture.contains(DRAWING) && picture.contains("#003"));
        assert!(!picture.contains("crispEdges"));
    }

    #[test]
    fn no_drawing_shows_the_sprite() {
        let picture = picture(None, 7, 3);
        assert!(picture.contains("crispEdges") && picture.contains("#003"));
    }

    #[test]
    fn editions_of_one_milestone_differ_only_in_the_plate() {
        let (one, two) = (picture(None, 7, 1), picture(None, 7, 2));
        assert_ne!(one, two);
        assert_eq!(one.replace("#001", ""), two.replace("#002", ""));
    }

    #[test]
    fn the_picture_is_well_nested() {
        for picture in [picture(Some(DRAWING), 1, 1), picture(None, 1, 1)] {
            assert_eq!(
                picture.matches("<svg").count(),
                picture.matches("</svg>").count()
            );
            assert!(picture.starts_with("<svg") && picture.ends_with("</svg>"));
        }
    }
}
