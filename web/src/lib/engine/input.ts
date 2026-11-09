import { get as httpsGet } from "https";
import type { Call, Chain } from "../types";

const SOL_ADDR = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const EVM_ADDR = /\b0x[a-fA-F0-9]{40}\b/g;
const TWITTER_EPOCH = 1288834974657n;

export function postTimeFromXId(id: string): number {
  return Number(((BigInt(id) >> 22n) + TWITTER_EPOCH) / 1000n);
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export function findToken(text: string): { chain: Chain; address: string } | null {
  const evm = text.match(EVM_ADDR);
  if (evm) return { chain: "base", address: evm[0] };
  const sol = (text.match(SOL_ADDR) || []).filter((a) => /[0-9]/.test(a) && /[a-z]/.test(a) && /[A-Z]/.test(a));
  if (sol.length) return { chain: "solana", address: sol[0] };
  return null;
}

async function tokenFromCashtag(text: string): Promise<{ chain: Chain; address: string; symbol: string } | null> {
  const tag = text.match(/\$([A-Za-z][A-Za-z0-9]{1,14})\b/);
  if (!tag) return null;
  const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(tag[1])}`, { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  const pairs = (j.pairs || []).filter(
    (p: { chainId: string; baseToken: { symbol: string } }) =>
      (p.chainId === "solana" || p.chainId === "base") && p.baseToken.symbol.toLowerCase() === tag[1].toLowerCase(),
  );
  pairs.sort((a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const p = pairs[0];
  return p ? { chain: p.chainId, address: p.baseToken.address, symbol: p.baseToken.symbol } : null;
}

export class InputError extends Error {}

// A post we already know the time and author of, such as a call forwarded to the Telegram bot.
export type InputHint = { postedAt?: number; handle?: string; displayName?: string; url?: string };

async function readTelegramPost(channel: string, id: string): Promise<{ text: string; postedAt: number; name?: string }> {
  // Plain HTTP/1.1: the serverless fetch trips over t.me's HTTP/2 frames.
  const html = await new Promise<string>((resolve) => {
    const req = httpsGet(`https://t.me/${channel}/${id}?embed=1&mode=tme`, { headers: { "user-agent": "Mozilla/5.0 (compatible; Wingman/1.0)" }, timeout: 10000 }, (res) => {
      let b = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (b += c));
      res.on("end", () => resolve(res.statusCode === 200 ? b : ""));
    });
    req.on("error", () => resolve(""));
    req.on("timeout", () => req.destroy());
  });
  const when = html.match(/<time[^>]*datetime="([^"]+)"/)?.[1];
  const body = html.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  if (!when || body === undefined) throw new InputError("We couldn't read that Telegram post. Only posts in public channels can be read.");
  const text = decodeEntities(body.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const name = html.match(/tgme_widget_message_owner_name[^>]*><span[^>]*>([^<]+)</)?.[1];
  return { text, postedAt: Math.floor(new Date(when).getTime() / 1000), name: name ? decodeEntities(name) : undefined };
}

// Turns whatever the user pasted into a Call. Throws InputError with a plain message.
// 0x addresses are read as Base. If the token only trades on another EVM chain, say so instead of "no trades".
async function checkEvmChain(call: Call): Promise<Call> {
  if (call.token.chain !== "base") return call;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${call.token.address}`, { cache: "no-store" });
    const pairs = ((await r.json()).pairs || []) as { chainId: string }[];
    if (pairs.length && !pairs.some((p) => p.chainId === "base")) {
      const other = pairs[0].chainId;
      throw new InputError(`Wingman reads Solana and Base. This token trades on ${other.charAt(0).toUpperCase() + other.slice(1)}, so there is nothing we can read or ride yet.`);
    }
  } catch (e) {
    if (e instanceof InputError) throw e;
  }
  return call;
}

export async function readInput(raw: string, hint?: InputHint): Promise<Call> {
  return checkEvmChain(await readInputRaw(raw, hint));
}

async function readInputRaw(raw: string, hint?: InputHint): Promise<Call> {
  const input = raw.trim();
  const tg = input.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]{4,32})\/(\d+)/);
  if (tg && !/^(joinchat|addstickers|share)$/i.test(tg[1])) {
    const post = await readTelegramPost(tg[1], tg[2]);
    const addr = findToken(post.text) || (await tokenFromCashtag(post.text));
    if (!addr) throw new InputError("That Telegram post doesn't name a token we can find.");
    return { source: "telegram", url: `https://t.me/${tg[1]}/${tg[2]}`, handle: tg[1].toLowerCase(), displayName: post.name, text: post.text, postedAt: post.postedAt, token: addr };
  }
  const x = input.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/);
  if (x) {
    const url = `https://x.com/${x[1]}/status/${x[2]}`;
    const postedAt = postTimeFromXId(x[2]);
    const r = await fetch(`https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(url)}`, { cache: "no-store" });
    if (!r.ok) throw new InputError("We couldn't read that post. It may be deleted or from a private account.");
    const j = await r.json();
    const text = decodeEntities(String(j.html || "").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const handle = String(j.author_url || "").split("/").pop()?.toLowerCase() || x[1].toLowerCase();
    const addr = findToken(text) || (await tokenFromCashtag(text));
    if (!addr) throw new InputError("That post doesn't name a token we can find. Paste the token address next to the link.");
    return { source: "x", url, handle, displayName: j.author_name, text, postedAt, token: addr };
  }
  const cast = input.match(/(?:warpcast\.com|farcaster\.xyz)\/[^/\s]+\/(0x[a-f0-9]{6,})/i);
  if (cast) {
    const r = await fetch(`https://api.neynar.com/v2/farcaster/cast?type=url&identifier=${encodeURIComponent(input)}`, {
      headers: { "x-api-key": process.env.NEYNAR_API_KEY || "" },
      cache: "no-store",
    });
    if (!r.ok) throw new InputError("We couldn't read that cast.");
    const c = (await r.json()).cast;
    const addr = findToken(c.text) || (await tokenFromCashtag(c.text));
    if (!addr) throw new InputError("That cast doesn't name a token we can find.");
    return {
      source: "farcaster",
      url: input,
      handle: c.author.username,
      displayName: c.author.display_name,
      text: c.text,
      postedAt: Math.floor(new Date(c.timestamp).getTime() / 1000),
      token: addr,
    };
  }
  // "@handle token" or "token @handle" or just a token
  const handle = input.match(/@([A-Za-z0-9_]{1,15})/)?.[1]?.toLowerCase();
  const addr = findToken(input);
  if (addr && hint?.postedAt)
    return { source: "telegram", url: hint.url, handle: handle || hint.handle, displayName: hint.displayName, text: input.slice(0, 500), postedAt: hint.postedAt, token: addr };
  if (addr) return { source: "token", handle, token: addr };
  throw new InputError("Paste an X post link, a Farcaster cast link, or a token address (add @handle to check a caller).");
}
