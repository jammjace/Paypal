/** Original, code-native celestial mark; decorative and hidden from assistive tech. */
export function PalMascot({ small = false }: { small?: boolean }) {
  return <svg className={small ? "pal-mascot small" : "pal-mascot"} viewBox="0 0 112 112" fill="none" aria-hidden="true">
    <path d="M56 9C61 9 64 32 70 38C76 44 101 47 101 54C101 61 77 66 70 72C64 79 61 102 54 102C47 102 45 80 38 73C31 66 9 63 9 56C9 49 32 45 38 38C44 31 49 9 56 9Z" fill="#FAE69B" stroke="#E5CE7E" strokeWidth="1.5" />
    <ellipse cx="44" cy="53" rx="2.8" ry="4" fill="#263957" /><ellipse cx="65" cy="53" rx="2.8" ry="4" fill="#263957" />
    <path d="M48 64Q55 71 62 63" stroke="#263957" strokeWidth="2.5" strokeLinecap="round" />
    <ellipse cx="36" cy="62" rx="5" ry="2.5" fill="#EDB4A4" /><ellipse cx="74" cy="62" rx="5" ry="2.5" fill="#EDB4A4" />
    <path d="m93 14 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#9FACEC" />
  </svg>;
}
