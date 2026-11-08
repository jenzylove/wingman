export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--line-2)" />
      <circle cx="16" cy="16" r="8" fill="none" stroke="var(--line-2)" />
      <path d="M16 16 L16 1.5 A14.5 14.5 0 0 1 29.6 11 Z" fill="var(--green)" opacity="0.35" />
      <path d="M5 21 L16 8 L27 21" fill="none" stroke="var(--amber)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="16" cy="22" r="2.2" fill="var(--green)" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[15px] font-semibold tracking-tight text-ink">Wingman</span>
    </span>
  );
}
