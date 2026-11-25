export default function Header() {
  return (
    <header className="top">
      <div className="mark" aria-hidden="true">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          stroke="#1a1405"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M4 16v0M9 11v10M14 6v20M19 10v12M24 13v6M28 16v0" />
        </svg>
      </div>
      <div>
        <h1>FreillDe SpeechText</h1>
        <p className="sub">
          Record lectures, turn audio and video into text, then study from your notes.
        </p>
      </div>
      <div className="badge">Notes stay in your browser</div>
    </header>
  );
}
