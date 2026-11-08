// Pure scoring logic. No network. Tested in crew.test.ts.
import type { Card, CrewMember, Trade } from "../types";

export const CO_BUY_WINDOW = 20; // seconds either side of the caller's buy

export type RepeatStat = { hits: number; of: number; offsets: number[] };

// For each of the caller's buys, which other wallets bought the same token within the window, and how far off.
export function repeatStats(
  callerBuys: { mint: string; ts: number }[],
  tradesByMint: Map<string, Trade[]>,
  callerWallets: Set<string>,
  window = CO_BUY_WINDOW,
): Map<string, RepeatStat> {
  const stats = new Map<string, RepeatStat>();
  const of = callerBuys.filter((b) => tradesByMint.has(b.mint)).length;
  for (const b of callerBuys) {
    const trades = tradesByMint.get(b.mint);
    if (!trades) continue;
    const first = new Map<string, number>();
    for (const t of trades) {
      if (t.side !== "buy" || callerWallets.has(t.wallet)) continue;
      const off = t.ts - b.ts;
      if (Math.abs(off) > window) continue;
      if (!first.has(t.wallet) || off < first.get(t.wallet)!) first.set(t.wallet, off);
    }
    for (const [w, off] of first) {
      const s = stats.get(w) || { hits: 0, of, offsets: [] };
      s.hits++;
      s.offsets.push(off);
      stats.set(w, s);
    }
  }
  return stats;
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

// Crew buys with or before the caller; copy bots buy right after, every time.
export function splitCrew(stats: Map<string, RepeatStat>, minHits = 2) {
  const crew: { wallet: string; stat: RepeatStat }[] = [];
  const copyBots: { wallet: string; stat: RepeatStat }[] = [];
  for (const [wallet, stat] of stats) {
    if (stat.hits < minHits) continue;
    (median(stat.offsets) <= 1 ? crew : copyBots).push({ wallet, stat });
  }
  const byHits = (a: { stat: RepeatStat }, b: { stat: RepeatStat }) => b.stat.hits - a.stat.hits;
  return { crew: crew.sort(byHits), copyBots: copyBots.sort(byHits) };
}

const fmtSec = (s: number) => {
  const a = Math.abs(Math.round(s));
  const t = a < 90 ? `${a}s` : a < 5400 ? `${Math.round(a / 60)} min` : `${(a / 3600).toFixed(1)} h`;
  return t;
};
export const rel = (s: number, ref = "the post") => (s < 0 ? `${fmtSec(s)} before ${ref}` : s === 0 ? `at the same moment as ${ref}` : `${fmtSec(s)} after ${ref}`);

// Builds the summary, coverage and verdict for a card from the wallets we attribute.
export function score(
  t0: number,
  hasPostTime: boolean,
  insiders: CrewMember[],
  windowTrades: Trade[],
  quoteUsd?: number,
): Pick<Card, "summary" | "coverage" | "verdict" | "verdictLine"> {
  const mine = new Set(insiders.map((m) => m.wallet));
  const all = insiders.flatMap((m) => m.trades);
  const buys = all.filter((t) => t.side === "buy");
  const sells = all.filter((t) => t.side === "sell");
  const firstBuy = buys.length ? Math.min(...buys.map((t) => t.ts)) - t0 : undefined;
  const sellsAfter = sells.filter((t) => t.ts >= t0);
  const firstSell = sells.length ? Math.min(...sells.map((t) => t.ts)) - t0 : undefined;
  const bought = buys.reduce((a, t) => a + t.tokenAmount, 0);
  const sold = sells.reduce((a, t) => a + t.tokenAmount, 0);
  const net = sells.reduce((a, t) => a + t.quoteAmount, 0) - buys.reduce((a, t) => a + t.quoteAmount, 0);
  const stillHoldingPct = bought > 0 ? Math.max(0, Math.min(100, Math.round(((bought - sold) / bought) * 100))) : 0;

  const earlyBuys = windowTrades.filter((t) => t.side === "buy" && t.ts <= t0);
  const earlyVol = earlyBuys.reduce((a, t) => a + t.quoteAmount, 0);
  const attributed = earlyBuys.filter((t) => mine.has(t.wallet)).reduce((a, t) => a + t.quoteAmount, 0);
  const pct = earlyVol > 0 ? Math.round((attributed / earlyVol) * 100) : 0;
  const coverage = {
    earlyVolumeAttributedPct: pct,
    note:
      earlyVol > 0
        ? `We can tie ${pct}% of the buying before ${hasPostTime ? "the post" : "the caller's first buy"} to wallets we know. Wallets we can't see may exist.`
        : "No buying before the reference time in the window we read.",
  };

  const usd = quoteUsd ? net * quoteUsd : undefined;
  const summary = {
    firstInsiderBuyOffset: firstBuy,
    firstInsiderSellOffset: firstSell,
    insidersSold: sellsAfter.length > 0,
    insiderNetQuote: net,
    insiderNetUsd: usd,
    stillHoldingPct,
  };
  const ref = hasPostTime ? "the post" : "the caller's first buy";
  const r = (x: number) => rel(x, ref);
  const q = (n: number) => `${Math.abs(n).toFixed(2)} ${all[0]?.quoteSymbol || "SOL"}${usd ? ` (about $${Math.round(Math.abs(usd)).toLocaleString("en-US")})` : ""}`;

  if (!all.length) {
    return {
      summary,
      coverage,
      verdict: "unknown",
      verdictLine: insiders.length
        ? "The wallets we know for this caller didn't trade this token around the post."
        : "We don't know any wallets for this caller yet, so we can't say what they did.",
    };
  }
  if (sellsAfter.length && firstBuy !== undefined && firstBuy <= 0 && net > 0) {
    return {
      summary,
      coverage,
      verdict: "sold_into_followers",
      verdictLine: `Insider wallets bought ${r(firstBuy)} and started selling ${r(Math.min(...sellsAfter.map((t) => t.ts)) - t0)}, coming out ${q(net)} ahead.`,
    };
  }
  if (sells.length && !hasPostTime && firstSell !== undefined) {
    return {
      summary,
      coverage,
      verdict: net > 0 ? "sold_into_followers" : "exited",
      verdictLine: `Insider wallets sold ${100 - stillHoldingPct}% within ${rel(firstSell, "").replace(/ (after|before) $/, "")} of the caller's first buy${net > 0 ? `, ${q(net)} ahead` : `, down ${q(net)}`}.`,
    };
  }
  if (sells.length) {
    return {
      summary,
      coverage,
      verdict: "exited",
      verdictLine: `Insider wallets bought ${firstBuy !== undefined ? r(firstBuy) : "earlier"} and have sold ${100 - stillHoldingPct}% so far${net > 0 ? `, ${q(net)} ahead` : ""}.`,
    };
  }
  return {
    summary,
    coverage,
    verdict: "clean",
    verdictLine: `Insider wallets bought ${firstBuy !== undefined ? r(firstBuy) : "earlier"} and haven't sold. Still holding ${stillHoldingPct}%.`,
  };
}
