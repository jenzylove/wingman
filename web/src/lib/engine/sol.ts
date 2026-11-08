// Solana trade reading via Helius enhanced transactions.
import type { Trade } from "../types";

const KEY = () => process.env.HELIUS_API_KEY || "";
const WSOL = "So11111111111111111111111111111111111111112";
const STABLES = new Set(["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type HTx = {
  signature: string;
  timestamp: number;
  feePayer: string;
  transactionError?: unknown;
  tokenTransfers?: { fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number }[];
  nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[];
};

async function helius(path: string): Promise<HTx[]> {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`https://api.helius.xyz/v0/${path}${path.includes("?") ? "&" : "?"}api-key=${KEY()}`, { cache: "no-store" });
    if (r.status === 429) {
      await sleep(800 * (i + 1));
      continue;
    }
    const j = await r.json().catch(() => null);
    if (Array.isArray(j)) return j;
    return []; // "no events in search period" and similar
  }
  return [];
}

// All transactions touching an address between two times, newest first, up to maxPages*100.
export async function txsBetween(address: string, from: number, to: number, maxPages = 8): Promise<HTx[]> {
  const out: HTx[] = [];
  let before = "";
  for (let p = 0; p < maxPages; p++) {
    const page = await helius(`addresses/${address}/transactions?limit=100&gte-time=${from}&lte-time=${to}${before ? `&before=${before}` : ""}`);
    if (!page.length) break;
    out.push(...page);
    before = page[page.length - 1].signature;
    if (page.length < 100) break;
  }
  return out.filter((t) => !t.transactionError);
}

export async function recentTxs(address: string, pages = 3): Promise<HTx[]> {
  const out: HTx[] = [];
  let before = "";
  for (let p = 0; p < pages; p++) {
    const page = await helius(`addresses/${address}/transactions?limit=100${before ? `&before=${before}` : ""}`);
    if (!page.length) break;
    out.push(...page);
    before = page[page.length - 1].signature;
  }
  return out.filter((t) => !t.transactionError);
}

// The trade the signer of this tx made in `mint`, if any.
export function tradeOf(t: HTx, mint: string): Trade | null {
  const s = t.feePayer;
  let tokIn = 0, tokOut = 0, sol = 0, usd = 0;
  for (const x of t.tokenTransfers || []) {
    if (x.mint === mint) {
      if (x.toUserAccount === s) tokIn += x.tokenAmount;
      if (x.fromUserAccount === s) tokOut += x.tokenAmount;
    } else if (x.mint === WSOL) {
      if (x.fromUserAccount === s) sol += x.tokenAmount;
      if (x.toUserAccount === s) sol -= x.tokenAmount;
    } else if (STABLES.has(x.mint)) {
      if (x.fromUserAccount === s) usd += x.tokenAmount;
      if (x.toUserAccount === s) usd -= x.tokenAmount;
    }
  }
  for (const n of t.nativeTransfers || []) {
    if (n.fromUserAccount === s) sol += n.amount / 1e9;
    if (n.toUserAccount === s) sol -= n.amount / 1e9;
  }
  const net = tokIn - tokOut;
  if (Math.abs(net) < 1e-9) return null;
  const side = net > 0 ? "buy" : "sell";
  return {
    wallet: s,
    side,
    ts: t.timestamp,
    tokenAmount: Math.abs(net),
    quoteAmount: Math.abs(sol),
    quoteSymbol: "SOL",
    usd: usd ? Math.abs(usd) : undefined,
    tx: t.signature,
  };
}

// Distinct tokens this wallet bought recently (excluding one), with first buy time.
export async function recentBuys(wallet: string, exclude?: string, max = 10) {
  const txs = await recentTxs(wallet, 3);
  const buys: { mint: string; ts: number }[] = [];
  for (const t of txs) {
    if (t.feePayer !== wallet) continue;
    const got = (t.tokenTransfers || []).find((x) => x.toUserAccount === wallet && x.mint !== WSOL && !STABLES.has(x.mint));
    if (!got || got.mint === exclude) continue;
    const prev = buys.find((b) => b.mint === got.mint);
    if (prev) prev.ts = Math.min(prev.ts, t.timestamp);
    else buys.push({ mint: got.mint, ts: t.timestamp });
  }
  return buys.slice(0, max);
}

export async function solUsd(): Promise<number | undefined> {
  try {
    const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${WSOL}`, { cache: "no-store" });
    const j = await r.json();
    return Number(j[WSOL]?.usdPrice) || undefined;
  } catch {
    return undefined;
  }
}

export async function tokenMeta(mint: string): Promise<{ symbol?: string; name?: string }> {
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${KEY()}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAsset", params: { id: mint } }),
      cache: "no-store",
    });
    const m = (await r.json()).result?.content?.metadata;
    return { symbol: m?.symbol, name: m?.name };
  } catch {
    return {};
  }
}
