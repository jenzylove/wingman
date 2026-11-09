/**
 * Wingman mark: three chevrons flying in a V. The lead flies ahead, two wingmen
 * trail on either side. Solid shapes on whole pixel units so it stays crisp at 16px.
 */
export const MARK_PATHS = [
  // lead
  "M16 3 L24 13 L19.5 13 L16 8.6 L12.5 13 L8 13 Z",
  // left wing
  "M7 15 L13.5 23 L9.5 23 L7 19.8 L4.5 23 L0.5 23 Z",
  // right wing
  "M25 15 L31.5 23 L27.5 23 L25 19.8 L22.5 23 L18.5 23 Z",
];

export function LogoMark({ size = 22, color = "var(--accent)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 26" aria-hidden className="block shrink-0">
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} fill={color} />
      ))}
    </svg>
  );
}

export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="group inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-display text-[22px] leading-none tracking-[0.04em] text-ink">Wingman</span>
    </span>
  );
}
