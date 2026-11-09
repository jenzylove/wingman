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
  accountData?: { account: string; nativeBalanceChange: number }[];
  fee?: number;
};

export class ReadError extends Error {}

// At most a few Helius reads at once, so a card's burst of reads doesn't trip rate limits.
let active = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 5) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await fn();
  } finally {
    await sleep(120);
    active--;
    waiting.shift()?.();
  }
}

// A failed read must never look like "no trades": empty means empty, anything else retries and then throws.
async function helius(path: string): Promise<HTx[]> {
  for (let i = 0; i < 6; i++) {
    const r = await slot(() => fetch(`https://api.helius.xyz/v0/${path}${path.includes("?") ? "&" : "?"}api-key=${KEY()}`, { cache: "no-store" })).catch(() => null);
    if (r && r.ok) {
      const j = await r.json().catch(() => null);
      if (Array.isArray(j)) return j;
      // "Failed to find events within the search period": nothing in this time range.
      if (j && /search period|no transactions|not found/i.test(JSON.stringify(j))) return [];
    } else if (r && r.status !== 429 && r.status < 500) {
      const text = await r.text().catch(() => "");
      if (/search period|no transactions|not found/i.test(text)) return [];
    }
    if (process.env.WM_DEBUG) console.error("helius retry", i, r?.status, path.slice(0, 120));
    await sleep(600 * (i + 1));
  }
  throw new ReadError("helius read failed");
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
  let tokIn = 0, tokOut = 0, sol = 0, usd = 0, wsol = 0;
  for (const x of t.tokenTransfers || []) {
    if (x.mint === mint) {
      if (x.toUserAccount === s) tokIn += x.tokenAmount;
      if (x.fromUserAccount === s) tokOut += x.tokenAmount;
    } else if (x.mint === WSOL) {
      if (x.fromUserAccount === s) wsol += x.tokenAmount;
      if (x.toUserAccount === s) wsol -= x.tokenAmount;
    } else if (STABLES.has(x.mint)) {
      if (x.fromUserAccount === s) usd += x.tokenAmount;
      if (x.toUserAccount === s) usd -= x.tokenAmount;
    }
  }
  // The signer's own WSOL leg is the real price when there is one (already wrapped SOL, or a wrap or unwrap in
  // the same swap). Otherwise the signer's native SOL change catches pump.fun and AMM proceeds that never show
  // as transfers.
  const acct = (t.accountData || []).find((a) => a.account === s);
  if (Math.abs(wsol) > 1e-9) sol += wsol;
  else if (acct && acct.nativeBalanceChange !== 0) sol += -(acct.nativeBalanceChange + (t.fee || 0)) / 1e9;
  else
    for (const n of t.nativeTransfers || []) {
      if (n.fromUserAccount === s) sol += n.amount / 1e9;
      if (n.toUserAccount === s) sol -= n.amount / 1e9;
    }
  const net = tokIn - tokOut;
  if (Math.abs(net) < 1e-9) return null;
  const side = net > 0 ? "buy" : "sell";
  // A buy must pay SOL or a stablecoin and a sell must receive one. Legs moving the wrong way (bots that only
  // collect, internal shuffles) don't count, so the same money is never added twice.
  const solLeg = side === "buy" ? sol : -sol;
  const usdLeg = side === "buy" ? usd : -usd;
  if (solLeg <= 1e-9 && usdLeg <= 1e-6) return null;
  return {
    wallet: s,
    side,
    ts: t.timestamp,
    tokenAmount: Math.abs(net),
    quoteAmount: Math.max(0, solLeg),
    quoteSymbol: "SOL",
    usd: usdLeg > 1e-6 ? usdLeg : undefined,
    tx: t.signature,
  };
}

// Distinct tokens this wallet bought recently (excluding one), with first buy time.
export async function recentBuys(wallet: string, exclude?: string, max = 10) {
  const txs = await recentTxs(wallet, 5);
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

// Some pools (Raydium AMM v4 and others) don't touch the mint account in a swap, so we also read the main pools.
const pairCache = new Map<string, string[]>();
export async function poolsOf(mint: string): Promise<string[]> {
  if (pairCache.has(mint)) return pairCache.get(mint)!;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { cache: "no-store" });
    const pairs = ((await r.json()).pairs || []) as { chainId: string; pairAddress: string; liquidity?: { usd?: number } }[];
    const top = pairs
      .filter((p) => p.chainId === "solana")
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
      .slice(0, 2)
      .map((p) => p.pairAddress);
    pairCache.set(mint, top);
    return top;
  } catch {
    return [];
  }
}

// Reads a token's trades across a time window. Busy tokens have thousands of trades a minute, and reads come
// newest first, so one read only sees the end of the window. Splitting the window into slices samples all of it.
export async function tokenTxsBetween(mint: string, from: number, to: number, maxPages = 6, opts: { slices?: number; pages?: number } = {}) {
  const addrs = [mint, ...(await poolsOf(mint))];
  const span = Math.max(1, to - from);
  const slices = Math.max(1, Math.min(opts.slices ?? 1, Math.ceil(span / 10)));
  const pages = opts.pages ?? (slices === 1 ? maxPages : 1);
  const step = span / slices;
  const jobs: Promise<HTx[]>[] = [];
  for (let i = 0; i < slices; i++) {
    const a = Math.floor(from + i * step);
    const b = i === slices - 1 ? to : Math.floor(from + (i + 1) * step) - 1;
    for (const addr of addrs) jobs.push(txsBetween(addr, a, b, pages));
  }
  const seen = new Map<string, HTx>();
  for (const list of await Promise.all(jobs)) for (const t of list) seen.set(t.signature, t);
  return [...seen.values()].sort((a, b) => b.timestamp - a.timestamp);
}
