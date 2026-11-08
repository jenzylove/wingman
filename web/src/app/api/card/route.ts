import { NextResponse } from "next/server";
import { buildCard } from "@/lib/engine/card";
import { InputError } from "@/lib/engine/input";
import { getCard, rateOk, saveCard } from "@/lib/store";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const input = String(body.input || "").slice(0, 500);
  if (!input) return NextResponse.json({ error: "Paste a post link or a token address." }, { status: 400 });
  if (/0x0{40}|^1{32,}$/.test(input)) return NextResponse.json({ error: "That isn't a real token address." }, { status: 422 });
  const ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
  if (!(await rateOk(`rl:card:${ip}`, 12, 600))) return NextResponse.json({ error: "Too many checks from here. Try again in a few minutes." }, { status: 429 });
  // Same input within 5 minutes: serve the card we just built.
  const memo = `cardmemo:${createHash("sha256").update(input.toLowerCase()).digest("hex").slice(0, 24)}`;
  const cachedId = await kvGetId(memo);
  if (cachedId) {
    const c = await getCard(cachedId);
    if (c && Date.now() / 1000 - c.computedAt < 300) return NextResponse.json({ card: c, cached: true });
  }
  try {
    const card = await buildCard(input);
    // Only cards backed by a real post go to the public feed; token plus handle checks stay private links.
    await saveCard(card, card.call.source !== "token");
    await kvSetId(memo, card.id);
    return NextResponse.json({ card });
  } catch (e) {
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("card failed", e);
    return NextResponse.json({ error: "Something failed while reading the chain. Try again in a moment." }, { status: 502 });
  }
}

import { kvGet, kvSet } from "@/lib/store";
const kvGetId = (k: string) => kvGet<string>(k);
const kvSetId = (k: string, id: string) => kvSet(k, id, 300);
