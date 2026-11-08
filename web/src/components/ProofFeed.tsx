"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getProof } from "@/lib/ui/api";
import { ago, chainName, short } from "@/lib/ui/format";
import type { Card } from "@/lib/types";
import ExitRow from "./ExitRow";

const VERDICT_TONE: Record<Card["verdict"], string> = {
  sold_into_followers: "bg-red",
  exited: "bg-amber",
  clean: "bg-green",
  unknown: "bg-ink-3",
};

export default function ProofFeed({ limit }: { limit?: number }) {
  const q = useQuery({ queryKey: ["proof"], queryFn: getProof, refetchInterval: 15_000 });

  if (q.isPending) {
    return <p className="text-[14px] text-ink-3">Loading live fills and cards…</p>;
  }
  if (q.isError) {
    return (
      <p className="text-[14px] text-red-ink" role="alert">
        {q.error instanceof Error ? q.error.message : "Could not load proof."}{" "}
        <button className="underline underline-offset-2" onClick={() => q.refetch()}>
          Retry
        </button>
      </p>
    );
  }

  const fills = q.data.exits.filter((x) => x.status === "fired").sort((a, b) => (b.exit?.ts ?? 0) - (a.exit?.ts ?? 0));
  const armedCount = q.data.exits.filter((x) => x.status === "armed").length;
  const cards = [...q.data.cards].sort((a, b) => b.computedAt - a.computedAt);
  const fl = limit ? fills.slice(0, limit) : fills;
  const cl = limit ? cards.slice(0, limit) : cards;

  return (
    <div className="grid gap-14 lg:grid-cols-[1.2fr_1fr]">
      <section aria-labelledby="fills-title">
        <div className="flex items-baseline justify-between gap-4">
          <h3 id="fills-title" className="font-display text-[13px] font-semibold uppercase tracking-[0.2em] text-ink-2">
            Live fills
          </h3>
          <p className="flex items-center gap-2 text-[12px] text-ink-3">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-green" aria-hidden />
            {armedCount} armed right now
          </p>
        </div>
        {fl.length === 0 ? (
          <p className="mt-4 text-[14px] text-ink-2">No exits have fired yet. When one does, both transactions show up here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {fl.map((x) => (
              <ExitRow key={x.id} x={x} showOwner />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="cards-title">
        <h3 id="cards-title" className="font-display text-[13px] font-semibold uppercase tracking-[0.2em] text-ink-2">
          Recent cards
        </h3>
        {cl.length === 0 ? (
          <p className="mt-4 text-[14px] text-ink-2">No cards yet. Paste a call to make the first one.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {cl.map((c) => (
              <li key={c.id}>
                <Link href={`/card/${encodeURIComponent(c.id)}`} className="group flex gap-3 py-4">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${VERDICT_TONE[c.verdict]}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[14px] leading-snug text-ink group-hover:underline">{c.verdictLine}</p>
                    <p className="mt-1 text-[12px] text-ink-3">
                      {c.call.handle ? `@${c.call.handle} · ` : ""}
                      {c.call.token.symbol ? `$${c.call.token.symbol}` : short(c.call.token.address)} · {chainName(c.call.token.chain)} · {ago(c.computedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
