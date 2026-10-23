// The ticker that runs over the top of a wall of covers. The words stay with the feature; the movement lives here once.

// A line of words that scrolls past. It repeats what the page already says, so it is hidden from assistive
// technology and stops when the person asks for less motion.
export function ArcadeTicker({ items }: { readonly items: readonly string[] }) {
  return (
    <div aria-hidden="true" className="arcade-ticker">
      <div className="arcade-ticker__track">
        {[...items, ...items].map((item, index) => (
          // The same words twice make the loop seamless, so a word is not unique by itself.
          <span key={`${item}-${String(index)}`}>{item}</span>
        ))}
      </div>
    </div>
  );
}
