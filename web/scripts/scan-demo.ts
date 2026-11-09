// Finds fresh, real calls for the demo: recent buys by known KOL wallets, built into cards.
import kols from "../src/data/kols-sol.json";
import { recentBuys } from "../src/lib/engine/sol";
import { buildCard } from "../src/lib/engine/card";
(async () => {
  const now = Date.now() / 1000;
  const list = (kols as any).kols.slice(0, Number(process.argv[2] || 30));
  const cands: { h: string; mint: string; ts: number }[] = [];
  for (let i = 0; i < list.length; i += 5) {
    const got = await Promise.all(list.slice(i, i + 5).map(async (k: any) => (await recentBuys(k.wallets[0]).catch(() => [])).filter((b) => now - b.ts < 14 * 3600).map((b) => ({ h: k.handle, ...b }))));
    cands.push(...got.flat());
  }
  console.log("candidates", cands.length);
  const out: any[] = [];
  for (const c of cands.slice(0, 25)) {
    try {
      const card = await buildCard(`${c.mint} @${c.h}`);
      const sold = [...card.callerWallets, ...card.crew].some((m) => m.trades.some((t) => t.side === "sell"));
      out.push({ h: c.h, mint: c.mint, ago: Math.round((now - c.ts) / 60) + "m", sym: card.call.token.symbol, crew: card.crew.length, bots: card.copyBots.length, sold, verdict: card.verdict, line: card.verdictLine, id: card.id });
      console.log(JSON.stringify(out[out.length - 1]));
    } catch (e) { console.log("skip", c.h, c.mint.slice(0, 6), String(e).slice(0, 80)); }
  }
})();
