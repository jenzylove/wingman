import type { Metadata } from "next";
import Link from "next/link";
import CardView from "@/components/CardView";
import { loadCard } from "@/lib/ui/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await loadCard(id);
  if (!r.ok) return { title: "Card" };
  const c = r.data;
  const who = c.call.handle ? `@${c.call.handle}` : "Caller";
  const token = c.call.token.symbol ? `$${c.call.token.symbol}` : "token";
  return {
    title: `${who} on ${token}`,
    description: c.verdictLine,
    openGraph: { title: `${who} on ${token}`, description: c.verdictLine },
  };
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadCard(id);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
      {r.ok ? (
        <CardView card={r.data} />
      ) : (
        <div className="mx-auto max-w-2xl py-16" role="alert">
          <p className="text-[11px] uppercase tracking-[0.2em] text-red-ink">{r.status === 404 ? "Card not found" : "Could not load this card"}</p>
          <h1 className="mt-3 font-display text-[26px] font-semibold leading-tight">
            {r.status === 404 ? "We have no card with this link. It may have been made on another server." : r.error}
          </h1>
          <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-amber px-6 font-display text-[13px] font-semibold text-on-accent">
            Check a call
          </Link>
        </div>
      )}
    </div>
  );
}
