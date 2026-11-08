import { NextResponse } from "next/server";
import { BaseFlowError, buyQuote, recordArm } from "@/lib/exits/base";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "quote") return NextResponse.json(await buyQuote({ taker: b.owner, token: b.token, ethWei: String(b.ethWei), slippageBps: Math.min(3000, Math.max(50, b.slippageBps ?? 1500)) }));
    if (b.action === "record") return NextResponse.json({ exit: await recordArm({ txHash: b.txHash, watch: b.watch || [], cardId: b.cardId }) });
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: e instanceof BaseFlowError ? 422 : 502 });
  }
}
