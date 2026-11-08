import { NextResponse } from "next/server";
import { onActivity } from "@/lib/exits/flow";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.HOOK_SECRET || req.headers.get("authorization") !== process.env.HOOK_SECRET)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const txs = await req.json().catch(() => []);
  const fired: string[] = [];
  for (const t of Array.isArray(txs) ? txs : []) if (t?.feePayer && !t.transactionError) fired.push(...(await onActivity(t)));
  return NextResponse.json({ ok: true, fired });
}
