import { createHash } from "crypto";
import type { Call, Card, CrewMember, Trade } from "../types";
import { kvGet, kvSet } from "../store";
import { InputError, readInput, type InputHint } from "./input";
import { callerWallets, kolName } from "./wallets";
import { qualifies, repeatStats, score, splitCrew, CO_BUY_WINDOW } from "./crew";
import * as sol from "./sol";
import * as base from "./base";

const BEFORE = 600; // read 10 min before the post
const AFTER = 1800; // and 30 min after
const EARLY = 180; // "right before the post" means the 3 minutes before it

const cardId = (c: Call) =>
  createHash("sha256")
    .update(c.url || `${c.token.chain}:${c.token.address}:${c.handle || ""}`)
    .digest("hex")
    .slice(0, 16);

type Adapter = {
  windowTrades(token: string, from: number, to: number): Promise<Trade[]>;
  walletTrades(wallet: string, token: string, from: number, to: number): Promise<Trade[]>;
  recentBuys(wallet: string, exclude: string): Promise<{ mint: string; ts: number }[]>;
  quoteUsd(): Promise<number | undefined>;
  meta(token: string): Promise<{ symbol?: string; name?: string }>;
};

const solana: Adapter = {
  async windowTrades(mint, from, to) {
    return (await sol.tokenTxsBetween(mint, from, to)).map((t) => sol.tradeOf(t, mint)).filter(Boolean) as Trade[];
  },
  async walletTrades(wallet, mint, from, to) {
    return (await sol.txsBetween(wallet, from, to, 6))
      .filter((t) => t.feePayer === wallet)
      .map((t) => sol.tradeOf(t, mint))
      .filter(Boolean) as Trade[];
  },
  recentBuys: (w, ex) => sol.recentBuys(w, ex, 16),
  quoteUsd: sol.solUsd,
  meta: sol.tokenMeta,
};

const adapters = { solana, base: base.adapter as Adapter };

// The caller's crew, learned from their recent buys. Cached per caller for an hour.
async function learnCrew(a: Adapter, handle: string, wallets: string[], exclude: string) {
  const key = `crew:${handle}:${wallets.join(",").slice(0, 120)}`;
  const cached = await kvGet<{ stats: [string, { hits: number; of: number; offsets: number[] }][]; tokens: number }>(key);
  if (cached) return { stats: new Map(cached.stats), tokens: cached.tokens };
  const firstBy = new Map<string, number>();
  for (const b of (await Promise.all(wallets.slice(0, 3).map((w) => a.recentBuys(w, exclude)))).flat())
    firstBy.set(b.mint, Math.min(b.ts, firstBy.get(b.mint) ?? Infinity));
  const buys = [...firstBy].map(([mint, ts]) => ({ mint, ts })).slice(0, 16);
  const byMint = new Map<string, Trade[]>();
  await Promise.all(
    buys.map(async (b) => {
      byMint.set(b.mint, await a.windowTrades(b.mint, b.ts - CO_BUY_WINDOW, b.ts + CO_BUY_WINDOW));
    }),
  );
  const fresh = repeatStats(buys, byMint, new Set(wallets));
  // Crew is remembered per caller for good: once a wallet has shown up as crew it stays crew, even after
  // the caller's recent tokens move on. We keep the strongest evidence seen for each wallet.
  const memKey = `crewmem:${handle}`;
  const mem = new Map((await kvGet<[string, { hits: number; of: number; offsets: number[] }][]>(memKey)) || []);
  for (const [w, st] of fresh) {
    const prev = mem.get(w);
    if (!prev || st.hits / Math.max(1, st.of) >= prev.hits / Math.max(1, prev.of)) mem.set(w, st);
  }
  const keep = [...mem].filter(([w, st]) => fresh.has(w) || qualifies(st)).slice(-300);
  await kvSet(memKey, keep);
  const stats = new Map(keep);
  await kvSet(key, { stats: [...stats], tokens: byMint.size }, 3600);
  return { stats, tokens: byMint.size };
}

export async function buildCard(raw: string, hint?: InputHint): Promise<Card> {
  const call = await readInput(raw, hint);
  const a = adapters[call.token.chain];
  const token = call.token.address;
  const [meta, quoteUsd, known] = await Promise.all([a.meta(token), a.quoteUsd(), callerWallets(call.handle, call.token.chain)]);
  call.token = { ...call.token, symbol: call.token.symbol || meta.symbol, name: meta.name };
  call.displayName ||= call.handle ? kolName(call.handle) : undefined;

  // Reference time: the post, or the caller's first buy when there is no post.
  let t0 = call.postedAt;
  const now = Math.floor(Date.now() / 1000);
  if (!t0) {
    const firsts = await Promise.all(known.map((k) => a.walletTrades(k.wallet, token, now - 7 * 86400, now)));
    const buys = firsts.flat().filter((t) => t.side === "buy");
    t0 = buys.length ? Math.min(...buys.map((t) => t.ts)) : now - BEFORE;
  }
  const from = t0 - BEFORE;
  const to = Math.min(now, t0 + AFTER);

  const [windowTrades, callerTrades, learned] = await Promise.all([
    Promise.all([a.windowTrades(token, from, t0 + 5), a.windowTrades(token, t0 + 6, to)]).then(([x, y]) => [...x, ...y]),
    Promise.all(known.map((k) => a.walletTrades(k.wallet, token, t0! - 6 * 3600, to))),
    call.handle && known.length ? learnCrew(a, call.handle, known.map((k) => k.wallet), token) : Promise.resolve(null),
  ]);

  if (!windowTrades.length && callerTrades.every((x) => !x.length))
    throw new InputError("We found no trades of this token around that time, so there is nothing to show.");
  const callerWalletsOut: CrewMember[] = known.map((k, i) => ({ ...k, trades: callerTrades[i].sort((x, y) => x.ts - y.ts) }));
  const tradesBy = new Map<string, Trade[]>();
  for (const t of windowTrades) tradesBy.set(t.wallet, [...(tradesBy.get(t.wallet) || []), t]);

  const crew: CrewMember[] = [];
  const copyBots: CrewMember[] = [];
  if (learned) {
    const split = splitCrew(learned.stats);
    for (const [list, out, kind] of [
      [split.crew, crew, "with or before"],
      [split.copyBots, copyBots, "right after"],
    ] as const) {
      for (const { wallet, stat } of list) {
        const trades = (tradesBy.get(wallet) || []).sort((x, y) => x.ts - y.ts);
        out.push({
          wallet,
          tier: "behaviour",
          evidence: stat.offsets.every((o) => Math.abs(o) <= 1) ? `Bought in the same second as this caller on ${stat.hits} of ${stat.of} recent tokens` : `Bought ${kind} this caller on ${stat.hits} of ${stat.of} recent tokens, within ${CO_BUY_WINDOW}s`,
          repeat: { hits: stat.hits, of: stat.of },
          firstBuyOffset: trades.find((t) => t.side === "buy") ? trades.find((t) => t.side === "buy")!.ts - t0 : undefined,
          trades,
        });
      }
    }
  }

  const activeCrew = crew.filter((c) => c.trades.length);

  // Wallets that bought in the minutes right before the post. Remembered per caller: a wallet seen early
  // on two or more of the same caller's posts becomes crew, learned from the posts people check.
  const early: CrewMember[] = [];
  if (call.postedAt) {
    const knownSet = new Set([...callerWalletsOut, ...activeCrew].map((m) => m.wallet));
    const spent = new Map<string, { first: number; q: number }>();
    for (const t of windowTrades) {
      if (t.side !== "buy" || t.ts < t0 - EARLY || t.ts > t0 || knownSet.has(t.wallet)) continue;
      const cur = spent.get(t.wallet) || { first: t.ts, q: 0 };
      spent.set(t.wallet, { first: Math.min(cur.first, t.ts), q: cur.q + t.quoteAmount });
    }
    const top = [...spent].sort((x, y) => y[1].q - x[1].q).slice(0, 15);
    const id = cardId(call);
    const histKey = call.handle ? `early:${call.handle}` : null;
    const hist = histKey ? (await kvGet<Record<string, string[]>>(histKey)) || {} : {};
    for (const [wallet, v] of top) {
      if (histKey) hist[wallet] = [...new Set([...(hist[wallet] || []), id])].slice(-20);
      const seen = hist[wallet]?.length || 1;
      const member: CrewMember = {
        wallet,
        tier: seen >= 2 ? "behaviour" : "early",
        evidence:
          seen >= 2
            ? `Bought in the minutes before ${seen} of this caller's posts that we have checked`
            : `Bought ${Math.max(0, t0 - v.first)}s before this post`,
        repeat: seen >= 2 ? { hits: seen, of: Object.values(hist).reduce((m, ids) => Math.max(m, ids.length), seen) } : undefined,
        firstBuyOffset: v.first - t0,
        trades: (tradesBy.get(wallet) || []).sort((x, y) => x.ts - y.ts),
      };
      (seen >= 2 ? activeCrew : early).push(member);
    }
    if (histKey) await kvSet(histKey, hist);
  }

  const known2 = [...callerWalletsOut, ...activeCrew];
  const knownTraded = known2.some((m) => m.trades.length);
  const insiders = knownTraded || !early.length ? known2 : early;
  const scored = score(t0, Boolean(call.postedAt), insiders, windowTrades, quoteUsd, knownTraded || !early.length ? undefined : `${early.length} wallets that got in early`);
  return {
    id: cardId(call),
    call: { ...call, postedAt: call.postedAt },
    callerWallets: callerWalletsOut,
    crew: activeCrew,
    copyBots: copyBots.filter((c) => c.trades.length),
    early,
    ...scored,
    computedAt: now,
  };
}
