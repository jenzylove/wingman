import { buildCard } from "../src/lib/engine/card";
import { recentBuys } from "../src/lib/engine/sol";
(async () => {
  const arg = process.argv[2];
  if (arg === "buys") { console.log(await recentBuys(process.argv[3])); return; }
  const t = Date.now();
  const c = await buildCard(arg);
  console.log(JSON.stringify({ secs: (Date.now() - t) / 1000, verdict: c.verdict, line: c.verdictLine, summary: c.summary, coverage: c.coverage, caller: c.callerWallets.map(w => [w.wallet.slice(0,6), w.tier, w.trades.map(t=>`${t.side} ${t.ts}`)]), crew: c.crew.map(w => [w.wallet.slice(0,6), w.evidence, w.trades.length]), copyBots: c.copyBots.map(w=>[w.wallet.slice(0,6), w.evidence]), token: c.call.token }, null, 1));
})();
