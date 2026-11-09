// Looks for Solana trades that carry both a real SOL leg and a stablecoin leg, to check for double counting.
import { tokenTxsBetween, tradeOf, solUsd } from "../src/lib/engine/sol";
import type { Trade } from "../src/lib/types";
(async () => {
  const now = Math.floor(Date.now() / 1000);
  const q = (await solUsd())!;
  const mints = [
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  ];
  let n = 0;
  for (const m of mints) {
    const ts = (await tokenTxsBetween(m, now - 300, now, 3)).map((t) => tradeOf(t, m)).filter(Boolean) as Trade[];
    n += ts.length;
    for (const t of ts)
      if (t.usd && t.quoteAmount * q > 1)
        console.log(m.slice(0, 5), t.side, "sol", t.quoteAmount.toFixed(4), `($${(t.quoteAmount * q).toFixed(2)})`, "usd", t.usd.toFixed(2), t.tx);
  }
  console.log("scanned", n);
})();
