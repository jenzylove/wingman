import type { Metadata } from "next";
import StakePanel from "@/components/StakePanel";

export const metadata: Metadata = { title: "Stake $VIBES" };

export default function StakePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:px-10">
      <p className="label text-accent-ink">For $VIBES stakers</p>
      <h1 className="mt-4 max-w-5xl font-display text-[64px] leading-[0.88] sm:text-[104px]">Free exits. A cut of every exit.</h1>
      <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">
        Stake 100,000 $VIBES or more on Base and your armed exits are free. Everyone else pays 0.5% of the exit, and 30% of those fees go to WingmanPool stakers, claimable onchain.
      </p>
      <div className="mt-16">
        <StakePanel />
      </div>
    </div>
  );
}
