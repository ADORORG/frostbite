// The share mark: three joined dots. Drawn here so it takes the text colour and needs no file.
export function ShareGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="share-glyph"
      focusable="false"
      height="1em"
      viewBox="0 0 24 24"
      width="1em"
    >
      <path
        d="M8.6 10.7 15.4 7M8.6 13.3l6.8 3.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="6" cy="12" fill="currentColor" r="3.2" />
      <circle cx="18" cy="5.6" fill="currentColor" r="3.2" />
      <circle cx="18" cy="18.4" fill="currentColor" r="3.2" />
    </svg>
  );
}
