import { NextResponse } from "next/server";
import { BaseFlowError, buyQuote, recordArm } from "@/lib/exits/base";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "quote") return NextResponse.json(await buyQuote({ taker: b.owner, token: b.token, ethWei: String(b.ethWei), slippageBps: Math.min(3000, Math.max(50, b.slippageBps ?? 1500)) }));
    if (b.action === "floor") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(String(b.token)) || !/^\d+$/.test(String(b.amount))) return NextResponse.json({ error: "Bad token or amount." }, { status: 400 });
      const r = await fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${b.token}&tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amountIn=${BigInt(b.amount)}`, { headers: { "x-client-id": "wingman" }, cache: "no-store" }).then((x) => x.json());
      const out = r.data?.routeSummary?.amountOut;
      if (!out) return NextResponse.json({ error: "No route to sell this token on Base right now." }, { status: 422 });
      return NextResponse.json({ floor: (BigInt(out) / 2n).toString(), quotedUsdc: out });
    }
    if (b.action === "record") return NextResponse.json({ exit: await recordArm({ txHash: b.txHash, watch: b.watch || [], signature: b.signature, cardId: b.cardId }) });
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: e instanceof BaseFlowError ? 422 : 502 });
  }
}
