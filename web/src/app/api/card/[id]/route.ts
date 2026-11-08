import { NextResponse } from "next/server";
import { getCard } from "@/lib/store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const card = await getCard((await params).id);
  return card ? NextResponse.json({ card }) : NextResponse.json({ error: "Card not found." }, { status: 404 });
}
