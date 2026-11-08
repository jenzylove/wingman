// Base trade reading from raw logs over a public RPC.
import type { Trade } from "../types";

const RPC = () => process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const WETH = "0x4200000000000000000000000000000000000006";
const CHUNK = 2500;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(RPC(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
    });
    const j = await r.json().catch(() => null);
    if (j && "result" in j) return j.result as T;
    await new Promise((s) => setTimeout(s, 600 * (i + 1)));
  }
  throw new Error(`base rpc ${method} failed`);
}
async function rpcBatch<T>(calls: { method: string; params: unknown[] }[]): Promise<T[]> {
  const r = await fetch(RPC(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: "2.0", id: i, ...c }))),
    cache: "no-store",
  });
  const j = (await r.json()) as { id: number; result: T }[];
  return j.sort((a, b) => a.id - b.id).map((x) => x.result);
}

const hex = (n: number) => "0x" + n.toString(16);
const num = (h: string) => parseInt(h, 16);
const addr = (topic: string) => "0x" + topic.slice(26).toLowerCase();
const pad = (a: string) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

const blockTs = new Map<number, number>();
async function tsOf(b: number) {
  if (!blockTs.has(b)) blockTs.set(b, num((await rpc<{ timestamp: string }>("eth_getBlockByNumber", [hex(b), false])).timestamp));
  return blockTs.get(b)!;
}
export async function blockAt(ts: number) {
  let hi = num(await rpc<string>("eth_blockNumber", []));
  if (ts >= (await tsOf(hi))) return hi;
  let lo = Math.max(1, hi - 2_000_000);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await tsOf(mid)) < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

type Log = { address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string };
async function logs(filter: Record<string, unknown>, fromB: number, toB: number) {
  const out: Log[] = [];
  for (let b = fromB; b <= toB; b += CHUNK) {
    out.push(...(await rpc<Log[]>("eth_getLogs", [{ ...filter, fromBlock: hex(b), toBlock: hex(Math.min(toB, b + CHUNK - 1)) }])));
  }
  return out;
}

const decimalsCache = new Map<string, number>();
async function decimals(token: string) {
  if (!decimalsCache.has(token)) {
    const r = await rpc<string>("eth_call", [{ to: token, data: "0x313ce567" }, "latest"]).catch(() => "0x12");
    decimalsCache.set(token, num(r) || 18);
  }
  return decimalsCache.get(token)!;
}

async function trades(token: string, fromB: number, toB: number, only?: string): Promise<Trade[]> {
  const t = token.toLowerCase();
  const filter: Record<string, unknown> = { address: t, topics: [TRANSFER] };
  const tl = only
    ? [...(await logs({ address: t, topics: [TRANSFER, pad(only)] }, fromB, toB)), ...(await logs({ address: t, topics: [TRANSFER, null, pad(only)] }, fromB, toB))]
    : await logs(filter, fromB, toB);
  if (!tl.length) return [];
  const dec = await decimals(t);
  // The pool is the address on the other side of most transfers.
  const freq = new Map<string, number>();
  for (const l of tl) for (const a of [addr(l.topics[1]), addr(l.topics[2])]) freq.set(a, (freq.get(a) || 0) + 1);
  const pool = [...freq].sort((a, b) => b[1] - a[1])[0][0];
  const byTx = new Map<string, Log[]>();
  for (const l of tl) byTx.set(l.transactionHash, [...(byTx.get(l.transactionHash) || []), l]);
  const hashes = [...byTx.keys()].slice(0, 400);
  const txs: { from: string; blockNumber: string }[] = [];
  for (let i = 0; i < hashes.length; i += 40) {
    txs.push(...(await rpcBatch<{ from: string; blockNumber: string }>(hashes.slice(i, i + 40).map((h) => ({ method: "eth_getTransactionByHash", params: [h] })))));
  }
  const wethLogs = await Promise.all([
    logs({ address: WETH, topics: [TRANSFER, pad(pool)] }, fromB, toB),
    logs({ address: WETH, topics: [TRANSFER, null, pad(pool)] }, fromB, toB),
  ]);
  const wethByTx = new Map<string, number>();
  for (const l of wethLogs.flat()) {
    const v = Number(BigInt(l.data)) / 1e18;
    const sign = addr(l.topics[2]) === pool ? 1 : -1; // into the pool = someone paying ETH
    wethByTx.set(l.transactionHash, (wethByTx.get(l.transactionHash) || 0) + sign * v);
  }
  const out: Trade[] = [];
  for (let i = 0; i < hashes.length; i++) {
    const h = hashes[i];
    const signer = txs[i]?.from?.toLowerCase();
    if (!signer) continue;
    let poolNet = 0n;
    for (const l of byTx.get(h)!) {
      const v = BigInt(l.data);
      if (addr(l.topics[1]) === pool) poolNet -= v;
      if (addr(l.topics[2]) === pool) poolNet += v;
    }
    if (poolNet === 0n) continue;
    const ts = await tsOf(num(txs[i].blockNumber));
    out.push({
      wallet: signer,
      side: poolNet < 0n ? "buy" : "sell",
      ts,
      tokenAmount: Number(poolNet < 0n ? -poolNet : poolNet) / 10 ** dec,
      quoteAmount: Math.abs(wethByTx.get(h) || 0),
      quoteSymbol: "ETH",
      tx: h,
    });
  }
  return out;
}

async function ethUsd() {
  try {
    const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + WETH, { cache: "no-store" });
    const p = (await r.json()).pairs?.find((x: { chainId: string; quoteToken: { symbol: string } }) => x.chainId === "base" && /USD/.test(x.quoteToken.symbol));
    return p ? Number(p.priceUsd) : undefined;
  } catch {
    return undefined;
  }
}

async function meta(token: string) {
  try {
    const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + token, { cache: "no-store" });
    const p = (await r.json()).pairs?.find((x: { chainId: string }) => x.chainId === "base");
    return { symbol: p?.baseToken?.symbol, name: p?.baseToken?.name };
  } catch {
    return {};
  }
}

export const adapter = {
  async windowTrades(token: string, from: number, to: number) {
    const [a, b] = await Promise.all([blockAt(from), blockAt(to)]);
    return trades(token, a, b);
  },
  async walletTrades(wallet: string, token: string, from: number, to: number) {
    const [a, b] = await Promise.all([blockAt(from), blockAt(to)]);
    return (await trades(token, a, b, wallet)).filter((t) => t.wallet === wallet.toLowerCase());
  },
  // Learning a Base caller's crew needs their token history; read the last 3 hours of incoming transfers.
  async recentBuys(wallet: string, exclude: string) {
    const now = Math.floor(Date.now() / 1000);
    const [a, b] = await Promise.all([blockAt(now - 3 * 3600), blockAt(now)]);
    const inc = await logs({ topics: [TRANSFER, null, pad(wallet)] }, a, b).catch(() => [] as Log[]);
    const seen = new Map<string, number>();
    for (const l of inc) {
      const tok = l.address.toLowerCase();
      if (tok === WETH || tok === exclude.toLowerCase() || seen.has(tok)) continue;
      seen.set(tok, num(l.blockNumber));
    }
    const out: { mint: string; ts: number }[] = [];
    for (const [mint, blk] of [...seen].slice(0, 8)) out.push({ mint, ts: await tsOf(blk) });
    return out;
  },
  quoteUsd: ethUsd,
  meta,
};
