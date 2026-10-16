//! The fallback picture: a 16 by 16 sprite, mirrored left to right, drawn from the milestone
//! alone in one of a fixed set of palettes. Adjacent pixels of one colour are drawn as one bar,
//! which keeps the picture short and cheap to build.

use super::text;

const SIZE: usize = 16;
const HALF: usize = SIZE / 2;

/// Three colours per palette, light to dark.
const PALETTES: [[&str; 3]; 8] = [
    ["#7fd8ff", "#c9f0ff", "#2f6f99"],
    ["#ff8a5b", "#ffd0b8", "#a8432a"],
    ["#b69cff", "#e3d9ff", "#5a3fa8"],
    ["#7fe3a8", "#d1f7e1", "#2e8a57"],
    ["#ffd37a", "#fff1c7", "#a8791f"],
    ["#ff8d9a", "#ffd6db", "#a83a49"],
    ["#8fb4ff", "#d8e5ff", "#3a58a8"],
    ["#f0f0f8", "#ffffff", "#7a7a99"],
];

const BACKGROUND: &str = "#0c0d1f";
const OPEN: &str = "<svg x=\"20\" y=\"20\" width=\"150\" height=\"150\" viewBox=\"0 0 16 16\" shape-rendering=\"crispEdges\"><rect width=\"16\" height=\"16\" fill=\"";

fn seed(milestone: u128) -> u32 {
    let folded = (milestone as u32)
        ^ ((milestone >> 32) as u32)
        ^ ((milestone >> 64) as u32)
        ^ ((milestone >> 96) as u32);
    folded.wrapping_mul(2_654_435_761) | 1
}

fn next(state: &mut u32) -> u32 {
    *state ^= *state << 13;
    *state ^= *state >> 17;
    *state ^= *state << 5;
    *state
}

/// One row of the left half; 0 is empty, 1 to 3 index the palette. Pixels near the edge are
/// likelier to stay empty, so the shape reads as a blob rather than noise.
fn half_row(state: &mut u32, y: usize) -> [u8; HALF] {
    let mut row = [0u8; HALF];
    for (x, cell) in row.iter_mut().enumerate() {
        let roll = (next(state) % 100) as usize;
        let dx = HALF - 1 - x;
        let dy = y.abs_diff(HALF);
        if roll + (dx * dx + dy * dy) / 2 > 78 {
            continue;
        }
        *cell = if roll < 20 {
            2
        } else if roll < 45 {
            3
        } else {
            1
        };
    }
    row
}

fn mirrored(half: &[u8; HALF]) -> [u8; SIZE] {
    let mut row = [0u8; SIZE];
    for (x, colour) in half.iter().enumerate() {
        row[x] = *colour;
        row[SIZE - 1 - x] = *colour;
    }
    row
}

fn push_bar(out: &mut String, palette: &[&str; 3], x: usize, y: usize, width: usize, colour: u8) {
    out.push_str("<rect x=\"");
    text::push_u128(out, x as u128);
    out.push_str("\" y=\"");
    text::push_u128(out, y as u128);
    out.push_str("\" width=\"");
    text::push_u128(out, width as u128);
    out.push_str("\" height=\"1\" fill=\"");
    out.push_str(palette[colour as usize - 1]);
    out.push_str("\"/>");
}

/// Appends the sprite as a nested `<svg>` for the frame to place.
pub fn push(out: &mut String, milestone: u128) {
    let mut state = seed(milestone);
    let palette = &PALETTES[(milestone % PALETTES.len() as u128) as usize];
    out.push_str(OPEN);
    out.push_str(BACKGROUND);
    out.push_str("\"/>");
    for y in 0..SIZE {
        let row = mirrored(&half_row(&mut state, y));
        let mut x = 0;
        while x < SIZE {
            let colour = row[x];
            let mut end = x + 1;
            while end < SIZE && row[end] == colour {
                end += 1;
            }
            if colour != 0 {
                push_bar(out, palette, x, y, end - x, colour);
            }
            x = end;
        }
    }
    out.push_str("</svg>");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sprite(milestone: u128) -> String {
        let mut out = String::new();
        push(&mut out, milestone);
        out
    }

    #[test]
    fn the_same_milestone_always_draws_the_same_sprite() {
        assert_eq!(sprite(7), sprite(7));
    }

    #[test]
    fn different_milestones_draw_different_sprites() {
        let sprites: Vec<_> = (1..=20).map(sprite).collect();
        let mut unique = sprites.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), sprites.len());
    }

    #[test]
    fn every_sprite_is_mirrored_and_inside_the_grid() {
        for milestone in 0..50 {
            let state = &mut seed(milestone);
            for y in 0..SIZE {
                let row = mirrored(&half_row(state, y));
                assert!(row.iter().zip(row.iter().rev()).all(|(a, b)| a == b));
            }
        }
    }

    #[test]
    fn bars_stay_inside_the_sixteen_pixel_grid() {
        let sprite = sprite(31);
        for bar in sprite.split("<rect ").skip(2) {
            let value = |name: &str| -> usize {
                let start = bar.find(name).expect("attribute") + name.len();
                bar[start..]
                    .split('"')
                    .next()
                    .expect("value")
                    .parse()
                    .expect("number")
            };
            assert!(value("x=\"") + value("width=\"") <= SIZE && value("y=\"") < SIZE);
        }
    }

    #[test]
    fn the_sprite_is_a_single_nested_svg() {
        let sprite = sprite(3);
        assert!(sprite.starts_with("<svg") && sprite.ends_with("</svg>"));
        assert_eq!(sprite.matches("<svg").count(), 1);
    }
}
