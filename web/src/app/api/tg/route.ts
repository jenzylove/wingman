// @wingmancheckerbot: forward any call (a channel post, an X or Telegram link, or a token) and get the crew read back.
// Read only. No wallets live in Telegram; riding happens on the card from the user's own wallet.
import { NextResponse, after } from "next/server";
import { buildCard } from "@/lib/engine/card";
import { InputError, type InputHint } from "@/lib/engine/input";
import { rateOk, saveCard } from "@/lib/store";
import type { Card } from "@/lib/types";
import { STANCE_HEADLINE, stanceOf } from "@/lib/ui/stance";

export const runtime = "nodejs";
export const maxDuration = 60;

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://wingman.jdollar.site").replace(/\/$/, "");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function tg(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({}));
}

// Same answer as the card's headline.
function stance(card: Card) {
  const st = stanceOf(card);
  const n = st.holding.length;
  const sub = {
    in: `${n} insider wallet${n === 1 ? "" : "s"} still holding. You can ride with an exit armed on them.`,
    selling: `Some sold, ${n} still holding.`,
    out: "They already sold. Buying now means buying from them.",
    none: "We couldn't tie any wallets to this call yet.",
  }[st.stance];
  return { key: st.stance, head: STANCE_HEADLINE[st.stance].toUpperCase(), sub };
}

function reply(card: Card) {
  const st = stance(card);
  const sym = card.call.token.symbol ? `$${card.call.token.symbol}` : card.call.token.address.slice(0, 6);
  const who = card.call.handle ? ` · @${card.call.handle}` : "";
  const text = `<b>${st.head}</b>\n${esc(sym)} on ${card.call.token.chain === "base" ? "Base" : "Solana"}${esc(who)}\n\n${esc(card.verdictLine)}\n\n${esc(st.sub)}`;
  const url = `${SITE()}/card/${card.id}`;
  const label = st.key === "out" ? "See what they did" : st.key === "selling" ? "Open the card" : "Ride with exit armed";
  return { text, reply_markup: { inline_keyboard: [[{ text: label, url }]] } };
}

const HELP =
  "Forward me any call: a post from a Telegram channel, an X post link, or a token address with the caller's @handle.\n\nI'll tell you if the caller's crew is still in or already sold, and give you a link to ride it with an exit that sells the moment they sell.";

type Msg = {
  message_id: number;
  date: number;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  forward_origin?: { type: string; date: number; chat?: { username?: string; title?: string }; message_id?: number; sender_user?: { username?: string } };
};

export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN || req.headers.get("x-telegram-bot-api-secret-token") !== process.env.TELEGRAM_WEBHOOK_SECRET)
    return NextResponse.json({ ok: false }, { status: 401 });
  const update = await req.json().catch(() => ({}));
  const m: Msg | undefined = update.message;
  if (!m || m.chat.type !== "private") return NextResponse.json({ ok: true });
  const text = (m.text || m.caption || "").trim();
  if (!text || /^\/(start|help)\b/.test(text)) {
    await tg("sendMessage", { chat_id: m.chat.id, text: HELP });
    return NextResponse.json({ ok: true });
  }
  if (!(await rateOk(`rl:tg:${m.chat.id}`, 10, 600))) {
    await tg("sendMessage", { chat_id: m.chat.id, text: "That's a lot of checks. Give me a few minutes." });
    return NextResponse.json({ ok: true });
  }
  // A forwarded post carries its original time and channel, which is exactly the reference point we need.
  const o = m.forward_origin;
  const hint: InputHint | undefined = o
    ? {
        postedAt: o.date,
        handle: (o.chat?.username || o.sender_user?.username)?.toLowerCase(),
        displayName: o.chat?.title,
        url: o.chat?.username && o.message_id ? `https://t.me/${o.chat.username}/${o.message_id}` : undefined,
      }
    : undefined;
  const sent = await tg("sendMessage", { chat_id: m.chat.id, reply_to_message_id: m.message_id, text: "Reading the chain around this call…" });
  const editId = sent?.result?.message_id;
  after(async () => {
    let out: { text: string; reply_markup?: unknown };
    try {
      const card = await buildCard(text.slice(0, 1000), hint);
      await saveCard(card, card.call.source !== "token");
      out = reply(card);
    } catch (e) {
      out = { text: e instanceof InputError ? e.message : "Something failed while reading the chain. Try again in a moment." };
    }
    await tg(editId ? "editMessageText" : "sendMessage", { chat_id: m.chat.id, message_id: editId, parse_mode: "HTML", ...out });
  });
  return NextResponse.json({ ok: true });
}
