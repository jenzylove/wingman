import { NextResponse } from "next/server";
import * as flow from "@/lib/exits/flow";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try {
    switch (b.action) {
      case "ride":
        return NextResponse.json(await flow.ride(b));
      case "hold":
        return NextResponse.json(await flow.holdArm(b));
      case "prepare":
        return NextResponse.json(await flow.prepareExit(b));
      case "confirm":
        return NextResponse.json({ exit: await flow.confirmArm(b) });
      case "cancel":
        return NextResponse.json(await flow.cancelTx(b.id, b.owner));
      case "cancelled":
        return NextResponse.json({ exit: await flow.cancelDone(b.id) });
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("exit flow", b.action, msg);
    return NextResponse.json({ error: msg }, { status: e instanceof flow.FlowError ? 422 : 502 });
  }
}
