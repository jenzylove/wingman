import { NextResponse } from "next/server";
import { recentCards, recentExits } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const [exits, cards] = await Promise.all([recentExits(50), recentCards(20)]);
  // Proof shows exits fired by a real sale. Exits that fired on a liquidity move (before that trigger was tightened)
  // stay in their owner's My exits, labelled, but they are not proof of the product working.
  return NextResponse.json({ exits: exits.filter((e) => e.status !== "pending" && e.trigger?.kind !== "moved"), cards });
}
