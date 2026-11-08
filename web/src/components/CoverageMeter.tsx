"use client";

import CountUp from "./CountUp";

export default function CoverageMeter({ pct, note }: { pct: number; note?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  const segments = 40;
  const lit = Math.round((v / 100) * segments);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[13px] text-ink-2">
          We can attribute{" "}
          <span className="font-display text-[15px] font-semibold text-ink">
            <CountUp value={v} format={(n) => `${Math.round(n)}%`} />
          </span>{" "}
          of buy volume before the post to known wallets.
        </p>
      </div>
      <div className="mt-3 flex h-3 gap-[3px]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label="Coverage of early buy volume">
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className="flex-1 rounded-[1px] transition-colors"
            style={{
              background: i < lit ? "var(--green)" : "var(--line-2)",
              opacity: i < lit ? 0.55 + 0.45 * (i / segments) : 1,
              transitionDelay: `${i * 18}ms`,
            }}
          />
        ))}
      </div>
      {note && <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{note}</p>}
    </div>
  );
}
