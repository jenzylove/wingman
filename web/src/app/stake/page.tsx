import type { Metadata } from "next";
import StakePanel from "@/components/StakePanel";

export const metadata: Metadata = { title: "Stake $VIBES" };

export default function StakePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
      <p className="text-[11px] uppercase tracking-[0.2em] text-green-ink">For $VIBES stakers</p>
      <h1 className="mt-2 font-display text-[30px] font-semibold tracking-tight sm:text-[44px]">Free exits. A cut of every exit.</h1>
      <p className="mt-3 max-w-xl text-[14px] text-ink-2">
        Stake 100,000 $VIBES or more on Base and your armed exits are free. Everyone else pays 0.5% of the exit, and 30% of those fees go to stakers, claimable onchain.
      </p>
      <div className="mt-12">
        <StakePanel />
      </div>
    </div>
  );
}
