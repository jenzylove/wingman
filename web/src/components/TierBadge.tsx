import type { Tier } from "@/lib/types";
import { TIER_INFO } from "@/lib/ui/format";

const STYLE: Record<Tier, string> = {
  claimed: "bg-ink text-bg border border-ink",
  public: "text-ink border border-ink",
  funded: "text-ink-2 border border-line-2",
  behaviour: "text-ink-2 border border-dashed border-ink-3",
  early: "text-ink-2 border border-dotted border-ink-3",
};

export default function TierBadge({ tier }: { tier: Tier }) {
  const info = TIER_INFO[tier];
  return (
    <span
      title={info.help}
      className={`inline-flex h-[18px] shrink-0 items-center px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${STYLE[tier]}`}
    >
      {info.label}
    </span>
  );
}
