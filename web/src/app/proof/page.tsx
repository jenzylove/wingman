import type { Metadata } from "next";
import ProofFeed from "@/components/ProofFeed";

export const metadata: Metadata = { title: "Proof", description: "Live armed exits, fills and recent cards, each linked to its transactions." };

export default function ProofPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:px-10">
      <p className="label text-accent-ink">Proof</p>
      <h1 className="mt-4 max-w-5xl font-display text-[64px] leading-[0.88] sm:text-[104px]">Every fill, on the explorer</h1>
      <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">
        Real exits and real cards as they happen. Each receipt links the crew sell that triggered it and the exit that followed.
      </p>
      <div className="mt-16">
        <ProofFeed />
      </div>
    </div>
  );
}
