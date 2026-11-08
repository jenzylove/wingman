import { NextResponse } from "next/server";
import { recentCards, recentExits } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const [exits, cards] = await Promise.all([recentExits(50), recentCards(20)]);
  return NextResponse.json({ exits: exits.filter((e) => e.status !== "pending"), cards });
}
