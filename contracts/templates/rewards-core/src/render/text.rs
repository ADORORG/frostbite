//! Number writing without `format!`, which costs several times the fuel in the Alkanes runtime.

pub fn push_u128(out: &mut String, mut value: u128) {
    let mut digits = [0u8; 39];
    let mut start = digits.len();
    loop {
        start -= 1;
        digits[start] = b'0' + (value % 10) as u8;
        value /= 10;
        if value == 0 {
            break;
        }
    }
    for digit in &digits[start..] {
        out.push(*digit as char);
    }
}

/// An edition number as shown on the plate: at least three digits, `#007`.
pub fn push_edition(out: &mut String, serial: u128) {
    out.push('#');
    if serial < 100 {
        out.push('0');
    }
    if serial < 10 {
        out.push('0');
    }
    push_u128(out, serial);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn number(value: u128) -> String {
        let mut out = String::new();
        push_u128(&mut out, value);
        out
    }

    #[test]
    fn numbers_match_the_standard_formatter() {
        for value in [0, 7, 10, 99, 100, 12345, u64::MAX as u128, u128::MAX] {
            assert_eq!(number(value), value.to_string());
        }
    }

    #[test]
    fn editions_are_padded_to_three_digits() {
        for (serial, shown) in [(1, "#001"), (42, "#042"), (999, "#999"), (1000, "#1000")] {
            let mut out = String::new();
            push_edition(&mut out, serial);
            assert_eq!(out, shown);
        }
    }
}
