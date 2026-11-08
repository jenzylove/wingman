import type { Metadata } from "next";
import ProofFeed from "@/components/ProofFeed";

export const metadata: Metadata = { title: "Proof", description: "Live armed exits, fills and recent cards, each linked to its transactions." };

export default function ProofPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
      <p className="text-[11px] uppercase tracking-[0.2em] text-amber-ink">Proof</p>
      <h1 className="mt-2 font-display text-[30px] font-semibold tracking-tight sm:text-[44px]">Every fill, on the explorer</h1>
      <p className="mt-3 max-w-xl text-[14px] text-ink-2">
        Real exits and real cards as they happen. Each receipt links the crew sell that triggered it and the exit that followed.
      </p>
      <div className="mt-12">
        <ProofFeed />
      </div>
    </div>
  );
}
