//! The collectible's picture: the builder's drawing inside a generated frame with a serial
//! plate, or a 16 by 16 four-colour sprite when the milestone has no drawing.

const FRAME_HEAD: &str = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\"><rect width=\"200\" height=\"200\" fill=\"#12142b\"/><rect x=\"8\" y=\"8\" width=\"184\" height=\"184\" rx=\"12\" fill=\"none\" stroke=\"#7fd8ff\" stroke-width=\"3\"/>";

fn next(state: &mut u32) -> u32 {
    *state ^= *state << 13;
    *state ^= *state >> 17;
    *state ^= *state << 5;
    *state
}

fn plate(serial: u128) -> String {
    format!("<rect x=\"62\" y=\"170\" width=\"76\" height=\"16\" rx=\"8\" fill=\"#000\" fill-opacity=\".45\"/><text x=\"100\" y=\"182\" text-anchor=\"middle\" font-family=\"monospace\" font-size=\"11\" fill=\"#fff\">#{serial:03}</text></svg>")
}

/// A mirrored sprite from the milestone number alone, so every claim of one milestone looks alike.
fn sprite(milestone: u128) -> String {
    let mut state = (milestone as u32).wrapping_mul(2654435761) | 1;
    let hue = (milestone % 360) as u32;
    let colours = [
        "#0c0d1f".to_string(),
        format!("hsl({hue},75%,62%)"),
        format!("hsl({},80%,76%)", (hue + 50) % 360),
        format!("hsl({},60%,38%)", (hue + 330) % 360),
    ];
    let mut out = String::new();
    for y in 0..16u32 {
        for x in 0..8u32 {
            let roll = next(&mut state) % 100;
            let distance = (x as i32 - 7).pow(2) + (y as i32 - 8).pow(2);
            if roll as i32 + distance / 2 > 78 {
                continue;
            }
            let colour = if roll < 20 {
                2
            } else if roll < 45 {
                3
            } else {
                1
            };
            for column in [x, 15 - x] {
                out.push_str(&format!(
                    "<rect x=\"{column}\" y=\"{y}\" width=\"1\" height=\"1\" fill=\"{}\"/>",
                    colours[colour]
                ));
            }
        }
    }
    format!("<svg x=\"20\" y=\"20\" width=\"160\" height=\"160\" viewBox=\"0 0 16 16\" shape-rendering=\"crispEdges\">{out}</svg>")
}

pub fn picture(art: &[u8], milestone: u128, serial: u128) -> Vec<u8> {
    let inner = match std::str::from_utf8(art) {
        Ok(text) if !text.is_empty() => {
            format!("<svg x=\"20\" y=\"20\" width=\"160\" height=\"150\">{text}</svg>")
        }
        _ => sprite(milestone),
    };
    format!("{FRAME_HEAD}{inner}{}", plate(serial)).into_bytes()
}
