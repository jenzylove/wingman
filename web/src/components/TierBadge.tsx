import type { Tier } from "@/lib/types";
import { TIER_INFO } from "@/lib/ui/format";

const STYLE: Record<Tier, string> = {
  claimed: "bg-amber text-on-accent",
  public: "text-amber-ink ring-1 ring-amber",
  funded: "text-ink-2 ring-1 ring-line-2",
  behaviour: "text-ink-3 border border-dashed border-line-2",
  early: "text-ink-3 ring-1 ring-line",
};

export default function TierBadge({ tier }: { tier: Tier }) {
  const info = TIER_INFO[tier];
  return (
    <span
      title={info.help}
      className={`inline-flex h-[18px] shrink-0 items-center rounded-full px-2 text-[10px] font-medium uppercase tracking-[0.12em] ${STYLE[tier]}`}
    >
      {info.label}
    </span>
  );
}
