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
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14 lg:px-10">
      {r.ok ? (
        <CardView card={r.data} />
      ) : (
        <div className="mx-auto max-w-2xl py-16" role="alert">
          <p className="label text-accent-ink">{r.status === 404 ? "Card not found" : "Could not load this card"}</p>
          <h1 className="mt-4 font-display text-[36px] leading-[0.95] sm:text-[52px]">
            {r.status === 404 ? "We have no card with this link. It may have been made on another server." : r.error}
          </h1>
          <Link href="/check" className="mt-8 inline-flex h-12 items-center bg-accent px-6 font-display text-[20px] text-on-accent transition hover:brightness-110">
            Check a call
          </Link>
        </div>
      )}
    </div>
  );
}
