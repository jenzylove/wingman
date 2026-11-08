import { NextResponse } from "next/server";
import { exitsOf, recentExits } from "@/lib/store";

export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner");
  return NextResponse.json({ exits: owner ? await exitsOf(owner) : await recentExits(50) });
}
