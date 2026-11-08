import { NextResponse } from "next/server";
import { parseAbiItem, type Hex } from "viem";
import { onBaseActivity, pub } from "@/lib/exits/base";
import { claimOnce, kvGet, kvSet, recentExits } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

// Scans new Base blocks for armed tokens leaving any watched wallet, then fires those exits.
// Called every few seconds by the keeper loop.
export async function GET(req: Request) {
  const want = process.env.HOOK_SECRET;
  if (!want || req.headers.get("x-wingman-key") !== want) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await claimOnce("cron:base", 3))) return NextResponse.json({ ok: true, skipped: "another run is in progress" });
  const c = pub();
  const head = await c.getBlockNumber();
  const last = BigInt((await kvGet<string>("base:lastBlock")) || (head - 50n).toString());
  const from = last + 1n > head - 1500n ? last + 1n : head - 1500n;
  if (from > head) return NextResponse.json({ ok: true, from: from.toString(), head: head.toString(), fired: [] });

  const armed = (await recentExits(200)).filter((e) => e.chain === "base" && e.status === "armed");
  const byToken = new Map<string, Set<string>>();
  for (const e of armed) {
    const s = byToken.get(e.token) || new Set<string>();
    e.watch.forEach((w) => s.add(w));
    byToken.set(e.token, s);
  }
  const fired: string[] = [];
  for (const [token, watch] of byToken) {
    const logs = await c.getLogs({ address: token as Hex, event: transfer, args: { from: [...watch] as Hex[] }, fromBlock: from, toBlock: head });
    for (const l of logs) {
      const blk = await c.getBlock({ blockNumber: l.blockNumber! });
      fired.push(...(await onBaseActivity({ from: l.args.from!, token, tx: l.transactionHash!, ts: Number(blk.timestamp) })));
    }
  }
  await kvSet("base:lastBlock", head.toString());
  return NextResponse.json({ ok: true, from: from.toString(), head: head.toString(), armed: armed.length, fired });
}
