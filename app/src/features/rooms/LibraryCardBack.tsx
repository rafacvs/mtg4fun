const spokes = Array.from({ length: 12 }, (_, index) => index * 30);

export function LibraryCardBack() {
  return <svg className="library-card-back" viewBox="0 0 63 88" aria-hidden="true">
    <rect x=".75" y=".75" width="61.5" height="86.5" rx="4" fill="#0d1022" stroke="#e2c47c" strokeWidth="1.5" />
    <rect x="5" y="5" width="53" height="78" rx="2" fill="#1a1745" stroke="#8d7440" strokeWidth=".6" />
    <g fill="none" stroke="#c9a763" strokeWidth=".7">
      <circle cx="31.5" cy="44" r="19" /><circle cx="31.5" cy="44" r="15" /><circle cx="31.5" cy="44" r="6" />
      {spokes.map(angle => <path key={angle} d="M31.500 38v-6M31.500 29l2.500 -4h-5Z" transform={`rotate(${angle} 31.500 44)`} />)}
    </g>
  </svg>;
}
