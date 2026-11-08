import { NextResponse } from "next/server";
import { callerWallets } from "@/lib/engine/wallets";
import { recentCards } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ handle: string }> }) {
  const handle = (await params).handle.replace(/^@/, "").toLowerCase();
  const [sol, base, cards] = await Promise.all([callerWallets(handle, "solana"), callerWallets(handle, "base"), recentCards(100)]);
  const recent = cards
    .filter((c) => c.call.handle?.toLowerCase() === handle)
    .map((c) => ({ id: c.id, token: c.call.token.address, chain: c.call.token.chain, symbol: c.call.token.symbol, ts: c.call.postedAt ?? c.computedAt, verdict: c.verdict, verdictLine: c.verdictLine, crewHits: c.crew.length }));
  return NextResponse.json({ handle, wallets: [...sol, ...base], recent });
}
