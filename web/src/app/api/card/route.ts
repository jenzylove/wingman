import { NextResponse } from "next/server";
import { buildCard } from "@/lib/engine/card";
import { InputError } from "@/lib/engine/input";
import { saveCard } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const input = String(body.input || "").slice(0, 500);
  if (!input) return NextResponse.json({ error: "Paste a post link or a token address." }, { status: 400 });
  try {
    const card = await buildCard(input);
    await saveCard(card);
    return NextResponse.json({ card });
  } catch (e) {
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("card failed", e);
    return NextResponse.json({ error: "Something failed while reading the chain. Try again in a moment." }, { status: 502 });
  }
}
